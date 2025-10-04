import  mongoose, { Schema }  from'mongoose';

const linkSchema = new mongoose.Schema({
  linkId: { type: String, unique: true },
  type: { type: String },
  recurrenceSettings: { type:  Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, index: { expires: '0s' } }, 
  validAt: { type: Date, },
  hostId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
});

const MeetLink = mongoose.model('meetlink', linkSchema);
export default MeetLink

