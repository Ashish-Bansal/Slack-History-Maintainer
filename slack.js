const request = require('request');
const WebSocket = require('ws');
const fs = require('fs');

const OAUTH_TOKEN = 'OAUTH_TOKEN';
const CHATS_DIRECTORY_NAME = 'chats';
const CHATS_DIRECTORY_PATH = `${__dirname}/${CHATS_DIRECTORY_NAME}`;

if (!fs.existsSync(CHATS_DIRECTORY_PATH)){
    fs.mkdirSync(CHATS_DIRECTORY_PATH);
}

const slackApiCall = (apiName, query, callback) => {
    request.get({
    url: `https://slack.com/api/${apiName}`,
    qs: query,
  }, (error, response, data) => {
    if (error || response.statusCode !== 200) {
      console.log(error);
      console.log(response.statusCode);
      process.exit(1);
    }
    const parsedResponse = JSON.parse(data);
    if (!parsedResponse.ok) {
      console.log(parsedResponse);
      process.exit(1);
    }

    if (callback !== undefined) {
      callback(parsedResponse);
    }
  });
};

const userList = [];
const publicChannelList = [];
const groupList = [];
const imList = [];

let firstMessage = true;

const getUserById = (id) => userList.find((user) => user.id === id);
const getChannelById = (id) => {
  return publicChannelList.find((c) => c.id === id)
    || groupList.find((g) => g.id === id)
    || imList.find((i) => i.id === id);
};

slackApiCall('rtm.connect', { token: OAUTH_TOKEN}, (response) => {
  console.log('rtm.connect successful. Will open web socket now...');
  const ws = new WebSocket(response.url);
  currentUser = response.self;

  ws.on('open', () => {
    console.log('websocket opened successfully!');
  });

  ws.on('message', (message) => {
    const parsedMessage = JSON.parse(message);
    if (parsedMessage.type !== 'message') {
      return;
    }

    // Ignore first message
    if (firstMessage) {
      firstMessage = false;
      return;
    }


    const userId = parsedMessage.user;
    const channelId = parsedMessage.channel;

    const user = getUserById(userId);
    const channel = getChannelById(channelId);
    if (!user || !parsedMessage.text || !channel) {
      fs.appendFile('error_log', user);
      fs.appendFile('error_log', channel);
      fs.appendFile('error_log', parsedMessage);
      console.log(user);
      console.log(channel);
      console.log(parsedMessage.text);
      return;
    }

    let filename;
    if (channel.is_channel || channel.is_group) {
      filename = channel.name_normalized;
    } else if (channel.is_im) {
      filename = getUserById(channel.user).name;
    }

    if (!filename) {
      filename = 'unknown_channel';
    }

    fs.appendFile(`${CHATS_DIRECTORY_PATH}/${filename}`, `${user.name} : ${parsedMessage.text}\n`);
  });
});

slackApiCall('users.list', { token: OAUTH_TOKEN}, (response) => {
  Array.prototype.push.apply(userList, response.members);
});

slackApiCall('channels.list', { token: OAUTH_TOKEN}, (response) => {
  Array.prototype.push.apply(publicChannelList, response.members);
  console.log(response);
});

slackApiCall('groups.list', { token: OAUTH_TOKEN}, (response) => {
  Array.prototype.push.apply(groupList, response.members);
  console.log(response);
});

slackApiCall('im.list', { token: OAUTH_TOKEN}, (response) => {
  Array.prototype.push.apply(imList, response.ims);
  console.log(response);
});
