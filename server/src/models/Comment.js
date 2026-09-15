const mongoose = require('mongoose');

const COMMENT_STATUS = Object.freeze(['ACTIVE', 'HIDDEN', 'DELETED']);

const CommentSchema = new mongoose.Schema(
  {
    userId: {type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true},
    storyId: {type: mongoose.Schema.Types.ObjectId, ref: 'Story', required: true},
    chapterId: {type: mongoose.Schema.Types.ObjectId, ref: 'Chapter', default: null},
    parentCommentId: {type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null},
    content: {type: String, required: true, trim: true},
    status: {type: String, required: true, enum: COMMENT_STATUS, default: 'ACTIVE'},
    likeCount: {type: Number, default: 0, min: 0},
  },
  {timestamps: true}
);

CommentSchema.index({storyId: 1, createdAt: -1});
CommentSchema.index({parentCommentId: 1});

// Cross-document chapter/story and parent-comment context checks belong to the
// repository/service. Comment deletion is status=DELETED, not soft-delete fields.
const Comment = mongoose.models.Comment || mongoose.model('Comment', CommentSchema);

module.exports = Comment;
