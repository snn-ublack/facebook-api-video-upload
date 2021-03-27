const fs = require('fs');
const fbUpload = require('./index.js');

const winston = require('winston');
const logger = winston.createLogger({
    "level": "info",
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.align(),
      winston.format.printf(info => `${info.timestamp} [${info.level.toUpperCase()}]: ${info.message}`)
    ),
    transports: [
        new winston.transports.Console(),
        // new winston.transports.File({ filename: 'combined.log' })
    ]
});


const c_ONEDAY_IN_SECONDS = 60 * 60 * 24
var c_PAGE_SCHEDULE_ARGS = {
    "published": false,
    "secret": false,
    "scheduled_publish_time": Math.round(new Date().getTime() / 1000) + c_ONEDAY_IN_SECONDS,
}

var c_PAGE_PUBLISH_NOW_ARGS = {
    "published": true,
    "secret": false,
}

const yargs_parser = require('yargs-parser')

/**
 * rmEmptyArgs.
 *
 * @param {object} args
 */
function rmEmptyArgs(args) {
    var keys = Object.keys(args);
    for (const k of keys) {
        var v = args[k];
        if (v === null || v === undefined){
            delete args[k]
        } else if (Array.isArray(v) && v.length === 0) {
            delete args[k];
        } else if (typeof(v) === "string" && v.length === 0){
            delete args[k];
        } else if (typeof(v) === "object" && Object.keys(v).length === 0) {
            delete args[k];
        }
    }
}

/**
 * main.
 *
 * @param {object} args
 * @param {string} jsonFileConfig
 */
async function main(args, jsonFileConfig) {
    var videoId = -1;
    var defaultConfig = {};
    if(args.jsonFileConfig) {
        let rawdata = fs.readFileSync(jsonFileConfig);
        defaultConfig = JSON.parse(rawdata);
        delete args.jsonFileConfig;
    }
    var runArgs = {};
    var keys = [].concat(Object.keys(args), Object.keys(defaultConfig));
    for (const k of keys) {
        runArgs[k] = args[k] || defaultConfig[k] || null;
    }
    rmEmptyArgs(runArgs);
    for (const k of ['file']){
        if (!runArgs[k]) {
            logger.error(`No such field '${k}' in ${JSON.stringify(runArgs)}`);
            return -1;
        }
    }

    runArgs['stream'] = fs.createReadStream(args['file']);
    delete runArgs['file'];

    if (runArgs.thumbnail) {
        runArgs['thumb'] = {
          value: fs.createReadStream(runArgs['thumbnail']),
          options: {
            filename: runArgs.thumbnail,
            contentType: 'image/jpg'
          }
        }
        delete runArgs['thumbnail'];
    }

    return fbUpload(runArgs).then(async (res) => {
      var d = await res.json();
      console.log('res: ', res);
      return d;
      // return res.json();
      //res:  { success: true, video_id: '1838312909759132' }
    }).catch((e) => {
      logger.error(JSON.stringify(e.error));
    });
    // return res;
}

// const args = {
//   token: "", // with the permission to upload
//   id: "", //The id represent {page_id || user_id || event_id || group_id}
//   stream: fs.createReadStream('./fixture.mp4'), //path to the video,
//   title: "my video",
//   description: "my description",
//   thumb: {
//     value: fs.createReadStream('./fixture.jpg'),
//     options: {
//       filename: 'fixture.jpg',
//       contentType: 'image/jpg'
//     }
//   }
//   // if you want the default thumb from the video just remove the field
//   // you can add any extra fields from the api https://developers.facebook.com/docs/graph-api/reference/page/videos/#Creating
//   // all keys except token, id, stream are passed to the final request
// };

main(args=yargs_parser(process.argv.slice(2)), jsonFileConfig="exampleConfig.json");
