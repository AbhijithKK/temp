import  mongoose  from'mongoose';
const { Schema, Types } = mongoose;

const FolderSchema = new Schema({
  _id: {
    type: Schema.Types.ObjectId,
    default: () => new Types.ObjectId()
  },
  name: {
    type: String,
    required: true
  },
  parentId: {
    type: Schema.Types.ObjectId,
    ref: 'Folder',
    default: null
  },
  files: [{
    type: Schema.Types.ObjectId,
    ref: 'File'
  }],
  subfolders: [{
    type: Schema.Types.ObjectId,
    ref: 'Folder'
  }],
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
  communityId: {
    type: Schema.Types.ObjectId,
    ref: 'Community',
    default: null
  }
}, {
  timestamps: {
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  }
});

// Indexes
FolderSchema.index({ parentId: 1 });
FolderSchema.index({ userId: 1 });

const folderSchema = mongoose.model('Folder', FolderSchema);
export default folderSchema;
