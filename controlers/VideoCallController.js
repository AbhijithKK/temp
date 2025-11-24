import { AccessToken } from "livekit-server-sdk";
import dotenv from "dotenv";
import { Router } from "express";
import authMiddleware from "../Helpers/AuthMiddleware.js";
const router = Router();

dotenv.config();

router.post("/token", authMiddleware, async (req, res) => {
  try {
    const { roomName, participantName, userId } = req.body;
console.log('req.body;',req.body);

    if (!roomName || !participantName || !userId) {
      return res.status(400).json({
        error: true,
        message: "Missing required fields: roomName, participantName, userId",
      });
    }

    const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
    const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return res.status(500).json({
        error: true,
        message: "LiveKit API credentials missing (check .env)",
      });
    }

    const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: userId.toString(),
      name: participantName,
    });

    token.addGrant({
      roomJoin: true,
      room: roomName,
    //   canPublish: true,
    //   canSubscribe: true,
    });

    const jwt = await token.toJwt();

    return res.status(200).json({
      error: false,
      token: jwt,
    });

  } catch (error) {
    console.error("LiveKit Token Error:", error);
    return res.status(500).json({
      error: true,
      message: "Server error generating token",
    });
  }
});
export default router;
