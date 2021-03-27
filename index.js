const streamToPromise = require('stream-to-promise')
const rp = require('request-promise')
// const rp = require(("node-fetch"))
//
//
// const rp = require("axios")


const c_BASED_URL = 'https://graph-video.facebook.com'
const c_VERSION = 'v3.2'
const c_URL = c_VERSION ? c_BASED_URL + "/" + c_VERSION  : c_BASED_URL + "/";

const retryMax = 10
let retry = 0

/**
 * apiInit.
 *
 * @param {object} args
 * @param {int} videoSize
 */
function apiInit(args, videoSize) {
  const options = {
    proxy: args.proxy || null,
    method: 'POST',
    uri: `${c_URL}/${args.id}/videos?access_token=${args.access_token}`,
    json: true,
    data : {
      upload_phase: 'start',
      file_size: videoSize
    }
  }
  return rp(options).then(res => res)
}

/**
 * apiFinish.
 *
 * @param {object} args
 * @param {string} upload_session_id
 * @param {string} video_id
 */
function apiFinish(args, upload_session_id, video_id) {
  const {access_token, id, stream, ...extraParams} = args

  const options = {
    method: 'POST',
    json: true,
    uri: `${c_URL}/${args.id}/videos`,
    formData: {
      ...extraParams,
      upload_session_id,
      access_token: args.access_token,
      upload_phase: 'finish',
    }
  }

  return rp(options).then(res => ({...res, video_id}))
}

/**
 * uploadChunk.
 *
 * @param {object} args
 * @param {string} id
 * @param {int} start
 * @param {int} chunk
 */
function uploadChunk(args, id, start, chunk) {
  const formData = {
    access_token: args.access_token,
    upload_phase: 'transfer',
    start_offset: start,
    upload_session_id: id,
    video_file_chunk: {
      value: chunk,
      options: {
        filename: 'chunk'
      }
    }
  }
  const options = {
    method: 'POST',
    uri: `${c_URL}/${args.id}/videos`,
    formData: formData,
    json: true
  }

  return rp(options)
    .then(res => {
      retry = 0
      return res
    })
    .catch(err => {
      if (retry++ >= retryMax) {
        return err
      }
      return uploadChunk(args, id, start, chunk)
    })
}


/**
 * uploadChain.
 *
 * @param {} buffer
 * @param {} args
 * @param {} res
 * @param {} ids
 */
function uploadChain(buffer, args, res, ids) {
  if (res.start_offset === res.end_offset) {
    return ids
  }

  var chunk = buffer.slice(res.start_offset, res.end_offset)
  return uploadChunk(args, ids[0], res.start_offset, chunk)
    .then(res => uploadChain(buffer, args, res, ids))
}


/**
 * facebookApiVideoUpload.
 *
 * @param {object} args
 */
function facebookApiVideoUpload(args) {
  return streamToPromise(args.stream)
    .then(buffer => Promise.all([buffer, apiInit(args, buffer.length)]))
    .then(([buffer, res]) => uploadChain(buffer, args, res, [res.upload_session_id, res.video_id]))
    .then(([id, video_id]) => apiFinish(args, id, video_id))
}

module.exports = facebookApiVideoUpload
