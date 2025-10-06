import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import MeetLink from "./Models/MeetLink.js";
import Participant from "./Models/ParticipentScheema.js";
import morgan from "morgan";
import authMiddleware from "./Helpers/AuthMiddleware.js";

const pendingRequests = new Map();
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const port = process.env.PORT || 3000;

// ✅ Socket.IO Setup
const io = new Server(server, {
  cors: {
    origin: process.env.PROD_URL1 || "http://localhost:8000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Store socket connections by user ID
const userSockets = new Map();
const hostSockets = new Map(); // Separate map for hosts by meeting ID

app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));
app.use(morgan('dev'));

// ✅ MongoDB Connection
mongoose
  .connect(process.env.DATABASE_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB Error:", err));

// ✅ Socket.IO Connection Handling
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Join user to their personal room
  socket.on("join-user", (userId) => {
    userSockets.set(userId, socket.id);
    socket.userId = userId;
    socket.join(`user-${userId}`);
    console.log(`User ${userId} joined their room`);
  });

  // Join host to meeting room
  socket.on("join-meeting-host", async (meetingId, userId) => {
    try {
      console.log(meetingId,userId,'join j=host');
      
      const meet = await MeetLink.findOne({ linkId: meetingId });
      console.log('join j=host');
      if (meet && meet.hostId.toString() === userId.toString()) {
        hostSockets.set(meetingId, socket.id);
        socket.meetingId = meetingId;
        socket.join(meetingId);
        console.log(`Host ${userId} joined meeting ${meetingId}`);
        
        // Send current pending requests to the host
        const requests = getPendingRequestsForMeeting(meetingId);
        socket.emit("pending-requests-update", requests);
      }
    } catch (error) {
      console.error("Error joining meeting as host:", error);
    }
  });

  // Handle join requests from participants
  socket.on("join-request", async (data) => {
    const { name, meetingId, userId } = data;
    
    try {
      const meet = await MeetLink.findOne({ linkId: meetingId });
      if (!meet) return;

      // Store the pending request
      const requestId = `${meetingId}-${userId}`;
      pendingRequests.set(requestId, {
        id: requestId,
        name,
        userId,
        meetingId,
        timestamp: Date.now()
      });

      // Notify host about the new request
      const hostSocketId = hostSockets.get(meetingId);
      console.log(hostSocketId,'hostSocketId');
      
      if (hostSocketId) {
        io.to(hostSocketId).emit("new-join-request", {
          id: requestId,
          name,
          userId,
          meetingId,
          timestamp: Date.now()
        });
      }

      console.log(`Join request from ${name} for meeting ${meetingId}`);
    } catch (error) {
      console.error("Error handling join request:", error);
    }
  });

  // Handle approval from host
  socket.on("approve-participant", async (requestId) => {
    try {
      const request = pendingRequests.get(requestId);
      if (!request) return;

      const { userId, meetingId } = request;
      
      // Remove from pending requests
      pendingRequests.delete(requestId);

      // Notify the participant they've been approved
      const userSocketId = userSockets.get(userId);
      if (userSocketId) {
        io.to(`user-${userId}`).emit("join-approved", { meetingId });
      }

      // Update all hosts in the meeting
      io.to(meetingId).emit("participant-approved", requestId);

      console.log(`Participant ${request.name} approved for meeting ${meetingId}`);
    } catch (error) {
      console.error("Error approving participant:", error);
    }
  });

  // Handle rejection from host
  socket.on("reject-participant", (requestId) => {
    try {
      const request = pendingRequests.get(requestId);
      if (!request) return;

      const { userId, meetingId } = request;
      
      // Remove from pending requests
      pendingRequests.delete(requestId);

      // Notify the participant they've been rejected
      const userSocketId = userSockets.get(userId);
      if (userSocketId) {
        io.to(`user-${userId}`).emit("join-rejected", { meetingId });
      }

      // Update all hosts in the meeting
      io.to(meetingId).emit("participant-rejected", requestId);

      console.log(`Participant ${request.name} rejected for meeting ${meetingId}`);
    } catch (error) {
      console.error("Error rejecting participant:", error);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    
    // Clean up user sockets
    if (socket.userId) {
      userSockets.delete(socket.userId);
    }
    
    // Clean up host sockets
    if (socket.meetingId) {
      hostSockets.delete(socket.meetingId);
    }
  });
});

// Helper function to get pending requests for a meeting
function getPendingRequestsForMeeting(meetingId) {
  const requests = [];
  for (const [key, value] of pendingRequests.entries()) {
    if (key.startsWith(meetingId)) {
      requests.push(value);
    }
  }
  return requests;
}

// ✅ Token Creator
const createToken = async (participantName, roomId, isAdmin = false) => {
  const at = new AccessToken(
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET,
    {
      identity: participantName,
      ttl: "10m",
    }
  );
  at.addGrant({ roomJoin: true, room: roomId, roomAdmin: isAdmin, ingressAdmin: isAdmin });
  return await at.toJwt();
};

// ✅ Token Endpoint with Approval Logic
app.get("/get-token", authMiddleware, async (req, res) => {
  const { name, meetingId, userId } = req.query;

  const meet = await MeetLink.findOne({ linkId: meetingId });
  if (!meet)
    return res.status(404).json({ error: true, message: "Meeting not found" });

  const isHost = meet?.hostId.toString() === userId.toString();
  const token = await createToken(name, meetingId, isHost);

  res.status(200).json({ 
    token, 
    error: false, 
    isHost 
  });
});

app.post("/kick", authMiddleware, async (req, res) => {
  const svc = new RoomServiceClient(
    process.env.WS_SERVER,
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET
  );
  const { roomId, identity } = req.body;
  await svc.removeParticipant(roomId, identity);
  res.json({ message: "Participant removed" });
});

// Store pending join requests

// Request to join endpoint
app.post("/request-join", authMiddleware, async (req, res) => {
  const { name, meetingId, userId } = req.body;
console.log(name, meetingId, userId);

  try {
    const meet = await MeetLink.findOne({ linkId: meetingId });
    if (!meet) {
      return res.status(404).json({ 
        success: false, 
        message: "Meeting not found" 
      });
    }

    // Check if user is host
    const isHost = meet.hostId.toString() === userId.toString();
    
    if (isHost) {
      // Host is auto-approved
      return res.status(200).json({ 
        success: true, 
        approved: true,
        isHost: true 
      });
    }

    // Store the pending request
    const requestId = `${meetingId}-${userId}`;
    pendingRequests.set(requestId, {
      id: requestId,
      name,
      userId,
      meetingId,
      timestamp: Date.now()
    });

    // Notify host via Socket.IO
    const hostSocketId = hostSockets.get(meetingId);
    if (hostSocketId) {
      io.to(hostSocketId).emit("new-join-request", {
        id: requestId,
        name,
        userId,
        meetingId,
        timestamp: Date.now()
      });
    }

    res.status(200).json({ 
      success: true, 
      approved: false,
      message: "Join request sent to host" 
    });

  } catch (error) {
    console.error("Error in request-join:", error);
    res.status(500).json({ 
      success: false, 
      message: "Internal server error" 
    });
  }
});

// Check approval status
app.get("/check-approval", authMiddleware, async (req, res) => {
  const { meetingId, userId } = req.query;

  try {
    const meet = await MeetLink.findOne({ linkId: meetingId });
    if (!meet) {
      return res.status(404).json({ 
        approved: false, 
        message: "Meeting not found" 
      });
    }

    // Host is always approved
    if (meet.hostId.toString() === userId.toString()) {
      return res.json({ approved: true });
    }

    // Check if this user has a pending request
    const requestId = `${meetingId}-${userId}`;
    const hasPendingRequest = pendingRequests.has(requestId);

    res.json({ approved: !hasPendingRequest });

  } catch (error) {
    console.error("Error checking approval:", error);
    res.status(500).json({ 
      approved: false, 
      message: "Error checking approval status" 
    });
  }
});

// Get pending requests (for host)
app.get("/pending-requests", authMiddleware, async (req, res) => {
  const { meetingId } = req.query;

  try {
    const requests = getPendingRequestsForMeeting(meetingId);
    res.json({ requests });
  } catch (error) {
    console.error("Error getting pending requests:", error);
    res.status(500).json({ 
      error: true, 
      message: "Internal server error" 
    });
  }
});

// Approve participant
app.post("/approve-participant", authMiddleware, async (req, res) => {
  const { requestId } = req.body;

  try {
    const request = pendingRequests.get(requestId);
    if (request) {
      pendingRequests.delete(requestId);
      
      // Notify participant via Socket.IO
      const userSocketId = userSockets.get(request.userId);
      if (userSocketId) {
        io.to(`user-${request.userId}`).emit("join-approved", { 
          meetingId: request.meetingId 
        });
      }

      // Notify host
      io.to(`host-${request.meetingId}`).emit("participant-approved", requestId);

      res.json({ success: true, message: "Participant approved" });
    } else {
      res.status(404).json({ 
        success: false, 
        message: "Request not found" 
      });
    }
  } catch (error) {
    console.error("Error approving participant:", error);
    res.status(500).json({ 
      success: false, 
      message: "Internal server error" 
    });
  }
});

// Update server startup
server.listen(port, () => console.log(`Server running on port ${port}`));