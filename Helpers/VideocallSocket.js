const userSocketMap = {}; // userId => socketId
const busyUsers = {};      // userId → true/false

export default function setupVideoCall(io) {
  const videoIO = io.of('/videocall');
  
  videoIO.on("connection", (socket) => {
    console.log("VideoCall socket connected:", socket.id);

    socket.on("register-user", (userId) => {
      userSocketMap[userId] = socket.id;
      console.log("User registered:", userId, socket.id);
    });

    
    socket.on("initiate-video-call", (data) => {
      const { roomName, callerId, callerName, receiverId } = data;
      if (busyUsers[receiverId]) {
        const callerSocket = userSocketMap[callerId];
        if (callerSocket) {
          videoIO.to(callerSocket).emit("user-busy", {
            message: "User is currently in another call",
          });
        }
        return;
      }
      const receiverSocket = userSocketMap[receiverId];

      if (!receiverSocket) {
        socket.emit("user-offline", "User is offline");
        return;
      }
      busyUsers[callerId] = true;
      videoIO.to(receiverSocket).emit("incoming-video-call", {
        roomName,
        callerName,
        callerId
      });

      console.log("Incoming call sent to:", receiverId);
    });

    
    socket.on("call-accepted", (callerId) => {
      const callerSocket = userSocketMap[callerId];
      busyUsers[socket.userId] = true;
      if (callerSocket) {
        videoIO.to(callerSocket).emit("call-accepted", {
          message: "Call accepted"
        });
        console.log("Call accepted by receiver");
      }
    });

    
    socket.on("video-call-canceled", (data) => {
      const { receiverId, receiverName, callerName, callerId } = data;
      const receiverSocket = userSocketMap[receiverId];
      delete busyUsers[receiverId];
  delete busyUsers[callerId];


      if (receiverSocket) {
        videoIO.to(receiverSocket).emit("video-call-ended", {
          receiverId: callerId,
          receiverName: callerName
        });
      }

      console.log("Call ended for:", receiverId);
    });

   
    socket.on("call-rejected", (data) => {
      const { callerId, receiverName } = data;
      const callerSocket = userSocketMap[callerId];

      if (callerSocket) {
        videoIO.to(callerSocket).emit("call-rejected", {
          message: `${receiverName} rejected your call`
        });
      }
    });

    
    socket.on("invite-to-call", (data) => {
      const { roomName, callerId, callerName, receiverId, receiverName } = data;

      const receiverSocket = userSocketMap[receiverId];

      if (!receiverSocket) {
        socket.emit("user-offline", `${receiverName} is offline`);
        return;
      }

      videoIO.to(receiverSocket).emit("incoming-video-call", {
        roomName,
        callerName,
        callerId
      });

      console.log(`Invited ${receiverId} to room ${roomName}`);
    });

    
    socket.on("participant-joined-call", (data) => {
      socket.broadcast.emit("participant-joined-call", data);
    });

    socket.on("participant-left-call", (data) => {
      socket.broadcast.emit("participant-left-call", data);
    });

    
    socket.on("disconnect", () => {
      console.log("VideoCall socket disconnected:", socket.id);
      for (const [userId, sockId] of Object.entries(userSocketMap)) {
        if (sockId === socket.id) {
          delete userSocketMap[userId];
          delete busyUsers[userId];
          break;
        }
      }
    });
  });
};