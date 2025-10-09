import mongoose from "mongoose";

const participantSchema = new mongoose.Schema({
  meetingId: { type: String, required: true }, // linkId from MeetLink
  userId: { type: String },
  name: { type: String },
  isRecording: { type: Boolean, default: false },
  recordingId: { type: String, },
  recordingStartTime: { type: Date, default: Date.now },
  recordingEndTime: { type: Date },
},{timestamps:true});

export default mongoose.model("meetRecording", participantSchema);
