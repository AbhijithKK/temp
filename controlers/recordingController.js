import { EgressClient } from "livekit-server-sdk";
import { configDotenv } from "dotenv";
import { Router } from "express";
import authMiddleware from "../Helpers/AuthMiddleware.js";
import MeetLink from "../Models/MeetLink.js";
import meetRecording from "../Models/ParticipentScheema.js";
import folderSchema from "../Models/CreateFolder.js";
import fileSechema from "../Models/FileSchema.js";
configDotenv();
// Initialize Egress Client  
const router = Router();

const egressClient = new EgressClient(
  process.env.LIVEKIT_SERVER_URL,
  process.env.LIVEKIT_API_KEY,
  process.env.LIVEKIT_API_SECRET
);

// Start recording endpoint
router.post("/start-recording", authMiddleware, async (req, res) => {
  const { roomName } = req.body;
  console.log("recordd", req.body);

  try {
    const meet = await MeetLink.findOne({ linkId: roomName });
    if (!meet) {
      return res
        .status(404)
        .json({ error: true, message: "Meeting not found" });
    }

    // Check if user is host
    if (meet.hostId.toString() !== req.user.id.toString()) {
      return res
        .status(403)
        .json({ error: true, message: "Only host can start recording" });
    }
    let recording = await meetRecording.findOne({ meetingId: roomName });
    if (!recording) {
      recording = await meetRecording.create({ meetingId: roomName });
    }
    // if (recording.isRecording) {
    //   return res
    //     .status(400)
    //     .json({ error: true, message: "Recording already in progress" });
    // }
    const filename = `${Date.now()}-${roomName}`;

    // Start recording
    const egressInfo = await egressClient.startRoomCompositeEgress(roomName, {
      template: {
        layout: "speaker-dark",
        room_name: roomName,
      },
      output: {
        case: "s3",
        value: {
          bucket: process.env.S3_PRIVATE_BUCKET_NAME,
          filename: filename,
        },
      },
      filepath: `${filename}`,
      options: {
        preset: "HD_60",
      },
    });

    console.log(egressInfo);

    // Update meeting
    recording.isRecording = true;
    recording.recordingId = egressInfo.egressId;
    recording.recordingStartTime = new Date();
    recording.userId = req.user.id;
    recording.name = req.user.username;
    recording.filename = filename;
    await recording.save();

    res.status(200).json({
      success: true,
      recordingId: egressInfo.egressId,
      message: "Recording started",
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
      return res
        .status(404)
        .json({ error: true, message: "Meeting not found" });
    }

    if (meet.hostId.toString() !== req.user.id.toString()) {
      return res
        .status(403)
        .json({ error: true, message: "Only host can stop recording" });
    }
    const recording = await meetRecording.findOne({ meetingId: roomName });

    if (!recording.isRecording || !recording.recordingId) {
      return res
        .status(400)
        .json({ error: true, message: "No recording in progress" });
    }

    // Stop recording
    const { result } = await egressClient.stopEgress(recording.recordingId);

    let folder = await folderSchema.findOne({
      userId: req.user.id,
      role: "User",
      name: "meet-Recordings",
    });

    if (!folder) {
      folder = await folderSchema.create({
        name: "meet-Recordings",
        userId: req?.user?.id,
        role: "User",
        createUserName: req?.user?.username,
        parentId: null,
        communityId: null,
      });
    }
    await fileSechema.create({
      path: result?.value?.filename,
      folderId: folder._id,
      name: result?.value?.filename || "No_Name",
      userId: req?.user?.id,
      role: "User",
      createUserName: req?.user?.username,
      type: "video/mp4",
      communityId: null,
    });

    recording.isRecording = false;
    recording.recordingEndTime = new Date();
    await recording.save();

    res.status(200).json({
      success: true,
      message: "Recording stopped",
      filename: recording?.filename,
    });
  } catch (error) {
    console.error("Error stopping recording:", error);
    res.status(500).json({ error: true, message: "Failed to stop recording" });
  }
});

export default router;
