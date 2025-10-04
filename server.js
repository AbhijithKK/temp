import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import dotenv from "dotenv";
import MeetLink from "./Models/MeetLink.js";
import Participant from "./Models/ParticipentScheema.js";

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));

// ✅ MongoDB Connection
mongoose
  .connect(process.env.DATABASE_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB Error:", err));

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
  at.addGrant({ roomJoin: true, room: roomId ,roomAdmin:isAdmin,ingressAdmin:isAdmin});
  return await at.toJwt();
};

// ✅ Token Endpoint with Approval Logic
// app.get("/get-token", async (req, res) => {
//   const { name, meetingId, userId } = req.query;

//   const meet = await MeetLink.findOne({ linkId: meetingId });
//   if (!meet)
//     return res.status(404).json({ error: true, message: "Meeting not found" });

//   // Host check
//   const isHost = meet.hostId === userId;

//   if (isHost) {
//     const token = await createToken(name, meetingId, true);
//     return res.status(200).json({ token, error: false, isHost: true });
//   }

//   // Check participant
//   let participant = await Participant.findOne({ meetingId, userId });

//   if (!participant) {
//     // New participant → waiting approval
//     participant = new Participant({ meetingId, userId, name, approved: false });
//     await participant.save();
//     return res
//       .status(200)
//       .json({ error: true, message: "Waiting for host approval..." });
//   }

//   if (!participant.approved) {
//     return res
//       .status(200)
//       .json({ error: true, message: "Host has not approved you yet." });
//   }

//   // Approved -> issue token
//   const token = await createToken(name, meetingId, false);
//   res.status(200).json({ token, error: false, isHost: false });
// });
app.get("/get-token", async (req, res) => {
  const { name, meetingId, userId } = req.query;

  const meet = await MeetLink.findOne({ linkId: meetingId });
  if (!meet)
    return res.status(404).json({ error: true, message: "Meeting not found" });
console.log(meet.hostId,userId);

  const isHost = meet?.hostId.toString() === userId.toString();
console.log(isHost);

  const token = await createToken(name, meetingId, isHost);

  res.status(200).json({ 
    token, 
    error: false, 
    isHost 
  });
});

// // ✅ Get participants (for host view)
// app.get("/participants", async (req, res) => {
//   const { meetingId, hostId } = req.query;

//   const meet = await MeetLink.findOne({ linkId: meetingId, hostId });
//   if (!meet)
//     return res.status(404).json({ error: true, message: "Meeting not found" });

//   const participants = await Participant.find({ meetingId });
//   res.status(200).json({ participants });
// });

// ✅ Approve a participant
// app.post("/approve", async (req, res) => {
//   const { meetingId, hostId, participantId } = req.body;

//   const meet = await MeetLink.findOne({ linkId: meetingId, hostId });
//   if (!meet)
//     return res.status(404).json({ error: true, message: "Meeting not found" });

//   const participant = await Participant.findOne({ meetingId, userId: participantId });
//   if (!participant)
//     return res.status(404).json({ error: true, message: "Participant not found" });

//   participant.approved = true;
//   await participant.save();

//   res.status(200).json({ error: false, message: "Participant approved successfully" });
// });


app.post("/kick", async (req, res) => {
  const svc = new RoomServiceClient(
    process.env.WS_SERVER,
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET
  );
    const { roomId, identity } = req.body;
    console.log(roomId, identity);
    
  await svc.removeParticipant(roomId, identity);
  res.json({ message: "Participant removed" });
});
app.listen(port, () => console.log(`Server running on port ${port}`));
