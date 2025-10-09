import { EgressClient } from 'livekit-server-sdk';
import { configDotenv } from "dotenv";
import { Router}from'express'
import authMiddleware from '../Helpers/AuthMiddleware.js';
import MeetLink from '../Models/MeetLink.js';
import ParticipentScheema from '../Models/ParticipentScheema.js';
configDotenv()
// Initialize Egress Client
const router = Router();
const egressClient = new EgressClient(
  'http://localhost:8080',  
 process.env.LIVEKIT_API_KEY,                
  process.env.LIVEKIT_API_SECRET                 
);

// Start recording endpoint
router.post("/start-recording", authMiddleware, async (req, res) => {
  const { roomName } = req.body;
console.log(req.body);

  try {
    const meet = await MeetLink.findOne({ linkId: roomName });
    if (!meet) {
      return res.status(404).json({ error: true, message: "Meeting not found" });
    }

    // Check if user is host
    if (meet.hostId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ error: true, message: "Only host can start recording" });
    }
    let recording=await ParticipentScheema.findOne({meetingId:roomName})
    if (!recording) {
        recording=await ParticipentScheema.create({meetingId:roomName})
    }
    if (recording.isRecording) {
      return res.status(400).json({ error: true, message: "Recording already in progress" });
    }

    // Start recording
    const egressInfo = await egressClient.startRoomCompositeEgress(roomName, {
      file: {
        filepath: `recordings/${roomName}_${Date.now()}.mp4`
      },
      preset: "HD_720_30"
    });
console.log(egressInfo);

    // Update meeting
    recording.isRecording = true;
    recording.recordingId = egressInfo.egressId;
    recording.recordingStartTime = new Date();
    recording.userId=req.user.id
    recording.name=req.user.username
    await recording.save();

    res.status(200).json({
      success: true,
      recordingId: egressInfo.egressId,
      message: "Recording started"
    });

  } catch (error) {
    console.error("Error starting recording:", error);
    res.status(500).json({ error: true, message: "Failed to start recording" });
  }
});

// Stop recording endpoint
router.post("/stop-recording", authMiddleware, async (req, res) => {
  const { roomName } = req.body;

  try {
    const meet = await MeetLink.findOne({ linkId: roomName });
    if (!meet) {
      return res.status(404).json({ error: true, message: "Meeting not found" });
    }

    if (meet.hostId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ error: true, message: "Only host can stop recording" });
    }
    const recording=await ParticipentScheema.findOne({meetingId:roomName})

    if (!recording.isRecording || !recording.recordingId) {
      return res.status(400).json({ error: true, message: "No recording in progress" });
    }

    // Stop recording
    await egressClient.stopEgress(meet.recordingId);

    recording.isRecording = false;
    recording.recordingEndTime = new Date();
    await recording.save();

    res.status(200).json({
      success: true,
      message: "Recording stopped"
    });

  } catch (error) {
    console.error("Error stopping recording:", error);
    res.status(500).json({ error: true, message: "Failed to stop recording" });
  }
});

export default router