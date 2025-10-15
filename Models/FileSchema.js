import  mongoose  from'mongoose';
const { Schema, Types } = mongoose;

const FileSchema = new Schema({
  _id: {
    type: Schema.Types.ObjectId,
    default: () => new Types.ObjectId()
  },
  name: {
    type: String,
    required: true
  },
  path: {
    type: String,
    required: true
  },
  folderId: {
    type: Schema.Types.ObjectId,
    ref: 'Folder',
    required: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  role: {
    type: String,
    default: null
  },
  createUserName: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true
  },
  communityId: {
    type: Schema.Types.ObjectId,
    ref: 'Community',
    default: null
  },
  size: {
    type: String,
    default: null
  }
}, {
  timestamps: {
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  }
});

// Indexes
FileSchema.index({ folderId: 1 });
FileSchema.index({ userId: 1 });

const fileSechema = mongoose.model('File', FileSchema);

export default fileSechema;
