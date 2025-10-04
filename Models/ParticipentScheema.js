import mongoose from "mongoose";

const participantSchema = new mongoose.Schema({
  meetingId: { type: String, required: true }, // linkId from MeetLink
  userId: { type: String, required: true },
  name: { type: String, required: true },
  approved: { type: Boolean, default: false },
  joinedAt: { type: Date, default: Date.now },
});

export default mongoose.model("meetParticipant", participantSchema);
