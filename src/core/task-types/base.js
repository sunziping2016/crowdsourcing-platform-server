module.exports = {
  toPlainObject(document, auth) {
    const result = {
      _id: document._id.toString(),
      name: document.name,
      publisher: document.publisher,
      description: document.description,
      excerption: document.excerption,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      type: document.type,
      tags: document.tags,
      status: document.status
    };
    if (document.picture !== undefined && document.pictureThumbnail !== undefined) {
      result.picture = '/uploads/' + document.picture;
      result.pictureThumbnail = '/uploads/' + document.pictureThumbnail;
    }
    return result;
  },
  async createHook(document, params, global) {}
};
