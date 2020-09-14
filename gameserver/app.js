
var serv = require('http').createServer();

var io = require('socket.io')(serv, {

    pingInterval: 1000,
    pingTimeout: 120000,

});

var port = 8080;

serv.listen(port);

const MAXP = 300;                      //max amount of players on a server
const ARENASIZE = 15000;
const ECOUNT = 7500;                  //amount of electrons on a server
const DISTARR = setDistanceConst();   //distance array for electrons in orbit

/*

  we want to define the module exports for this file
  before we require other files that are user defined (player.js, electron.js, neutron.js)

  this way the require('./app') for other files will not be simply an empty object
  when they are required here

*/

module.exports = {

  //max players constant

  maxPlayers: MAXP,
  electronCount: ECOUNT,

  /*

  getters

  getServer, getElectronList, and getNeutrons returns an array of objects
  getPlayer, and getElectron return and individual object

  */

  getTotalServerCount: function(){

    return Object.keys(servers).length;

  },

  getTotalPlayerCount: function(){

    return countAllPlayers();

  },

  getServer: function(serverId){

    if(servers[serverId]){

      return servers[serverId].players;

    }

  },

  getPlayer: function(serverId, id){

    if(servers[serverId]){

      return servers[serverId].players[id];

    }

  },

  getElectronList: function(serverId){

    //this one was giving me some problems when called from the electronHit interval in player.js
    //this solution seems to work (just give an empty array if the server was cleared)

    if(servers[serverId]){

      return servers[serverId].electrons;

    }

    return [];

  },

  getElectron: function(serverId, index){

    if(servers[serverId]){

      return servers[serverId].electrons[index];

    }

  },

  getNeutrons: function(serverId){

    if(servers[serverId]){

      return servers[serverId].neutrons;

    }

    return {};

  },

  playerExists: function(serverId, id){

    //seeing if a player on server exists

    if(servers[serverId]){

      if(servers[serverId].players[id]){

        return true;

      }

    }

    return false;

  },

  serverExists: function(serverId){

    if(servers[serverId]){

      return true;

    }

    return false;

  },

  getArenaSize: function(serverId){

    if(servers[serverId]){

      return servers[serverId].arenaSize;

    }

  },

  getDistanceArr: function(serverId){

    if(servers[serverId]){

      return servers[serverId].playerOrbitalDistances;

    }

  },

  removeBot: function(id, serverId){

    if(servers[serverId]){

      servers[serverId].removePlayer(id);

    }

  },

  clearSenderId: function(serverId, id){

    if(servers[serverId]){

      servers[serverId].clearSenderId(id);

    }

  },

  //various server alerts

  /*

  alert all players on server

  */

  serverAlert: function(serverId, msgName, msg){

    var i, playerList = servers[serverId].players;

    for(i in playerList){

      var player = playerList[i];

      player.socket.emit(msgName, msg);

    }

  },

  /*

  only alert players within a certain distance to an event
  (will reach players within roughly a quarter of the map, 4000x4000)

  */

  selectiveServerAlert: function(serverId, msgName, msg, xc, yc){

    var proximity = getProximityObj(xc, yc, 2000),
        playerList = servers[serverId].players, i;

    for(i in playerList){

      var player = playerList[i];

      if(proximityCheck(proximity, player)){

        player.socket.emit(msgName, msg);

      }

    }

  },

  /*

  only alert players with that electron in their
  local electrons object

  */

  electronAlert: function(serverId, msgName, msg, eIndex){

    if(servers[serverId]){

      var i, playerList = servers[serverId].players;

      for(i in playerList){

        var player = playerList[i];

        if(typeof player.electronProxim[eIndex] !== 'undefined'){

          player.socket.emit(msgName, msg);

        }

      }

    }

  },

  /*

  only alert players with that player in their
  local enemies object

  */

  enemyAlert: function(serverId, msgName, msg, playerId){

    var i, playerList = servers[serverId].players;

    for(i in playerList){

      var player = playerList[i];

      if(typeof player.enemProx[playerId] !== 'undefined'){

        player.socket.emit(msgName, msg);

      }

    }

  },

  neutronAlert: function(serverId, msgName, msg, neutronId){

    var i, playerList = servers[serverId].players;

    for(i in playerList){

      var player = playerList[i];

      if(typeof player.neutronProxim[neutronId] !== 'undefined'){

        player.socket.emit(msgName, msg);

      }

    }

  },

  /*

  only alert players with notifications turned on
  first index in array send will determine type of message

  0 - player has left game
  1 - player has joined game
  2 - player has eliminated another player
  3 - player was eliminated by themself

  */

  /*

  notifyAlert: function(serverId, msgName, msg){

    var i, playerList = servers[serverId].players;

    for(i in playerList){

      var player = playerList[i];

      if(player.notify){

        player.socket.emit(msgName, msg);

      }

    }

  }

  */

};

var Player = require('./player.js');
var Server = require('./server.js');

var servers = {};

//connnection handler

io.sockets.on('connection', function(socket){

  socket.id = Math.random();

  console.log('connection on server ' + port + ' - id: ' + socket.id);

  //define serv and player, however players will pass through here in deciding process
  //serv and player may not be utilized

  var serv, player;

  /**

  client -> server communication
  some of these methods are small enough to implement right here

  @param {} data data sent from client, usually in form of object, number, or array

  hi -            player wants a response to measure latency
  join -          player has decided to join this server based off latency test
  idRequest -     player requests their id on server
  start -         player starts game from home page, sends a data object of their attributes (name, color)
  res -           player sends their screen resolution
  eRequest -      player wants information on electron
  enemyReq -      player is requesting constructor for another player they did not recieve
  disconnect -    player leaves
  se -            send back message, user is doing latency tracking
  tr -            send back time stamp, user is doing more latency tracking
  message -       players mouse location
  f -             player fires an electron

  */

  socket.on('hi', function(){

    socket.emit('hi');

  });

  socket.on('join', function(){

    //only make a player if there isnt one alredy

    if(!player){

      serv = findServer();

      player = new Player(socket.id, socket, serv);

      servers[serv].addPlayer(socket.id, player);

      socket.emit('id', {

        id: socket.id,
        arena: ARENASIZE

      });

    }

  });

  socket.on('loaded', function(){

    if(player){

      if(!player.initIntervalsRunning){

        player.constantlyRunningIntervals();

      }

    }

  });

  socket.on('start', function(data){

    if(player){

      playerStart(player, data);

      if(!player.alive && player.allowReq){

        player.add();

      }

    }

  });

  socket.on('res', function(data){

    if(player){

      player.setResolution(data);

    }

  });

  socket.on('eRequest', function(data){

    if(player){

      electronRequest(data, player);

    }

  });

  socket.on('enemyReq', function(data){

    if(player){

      enemyRequest(data, player);

    }

  });

  socket.on('disconnect', function(){

    console.log('closed on server ' + port);

    if(player){

      playerLeft(player);

    }

  });

  socket.on('se', function(){

    socket.emit('re');

  });

  socket.on('tr', function(){

    socket.emit('rt', (Date.now()));

  });

  socket.on('message', function(data){

    if(player){

      if(player.alive){

        player.handleInput(data);

      }

    }

  });

  socket.on('f', function(){

    if(player){

      if(player.alive){

        player.fire();

      }

    }

  });

});

/*

functions

*/


function findServer(){

  var serverId, i, j;

  for(i in servers){

    //find how many players are on server (non-bots)

    var playerCount = servers[i].getPlayerCount();

    if(playerCount < MAXP){

      //disable a bot that this player is taking

      servers[i].extractBot(MAXP);

      return i;

    }

  }

  //couldnt find a server, make a new one

  var serverId = Math.random();

  var newServ = new Server(serverId, ECOUNT, ARENASIZE, DISTARR);

  servers[serverId] = newServ;

  newServ.initServer(MAXP);

  return serverId;

}

function countAllPlayers(){

  var i, totalPlayers = 0;

  for(i in servers){

    var tempTotal = servers[i].getPlayerCount();

    totalPlayers += tempTotal;

  }

  return totalPlayers;

}

function playerStart(player, attributes){

  var serv = player.server;

  if(typeof attributes === 'object'){

    player.addAttributes(attributes);

    //if this is the players first time player (if not, then the gaming flag will be turned on)

    if(!player.gaming){

      player.gaming = true;
      //module.exports.notifyAlert(serv, 'notif', [1, player.name, countActivePlayers(serv)]);

    }

  }

}

function electronRequest(index, player){

  var serv = player.server;

  if(typeof index === 'number'){

    if(index > -1 && index <= ECOUNT){

      var es = servers[serv].electrons;

      //verify that electron is near them

      var plyrNegX = player.xc - 1440, plyrPosX = player.xc + 1440;
      var plyrNegY = player.yc - 810, plyrPosY = player.yc + 810;

      if((plyrNegX < es[index].xc && es[index].xc < plyrPosX) &&
      (plyrNegY < es[index].yc && es[index].yc < plyrPosY)){

        //send

        player.cacheElectron(index, false);

      }

    }

  }

}

function enemyRequest(id, player){

  var serv = player.server;

  if(typeof index === 'number'){

    //see if player is in object, if so, then resend data

    if(typeof player.enemProx[id] !== 'undefined'){

      var enem = servers[serv].players[id];

      player.socket.emit('enemConst', [

        enem.name,
        enem.color,
        enem.index,
        enem.xc,
        enem.yc

      ]);

    }

  }

}

function playerLeft(player){

  //clear intervals

  player.clearIntervals();
  player.resetPlayer();

  var name = player.name;
  var serverId = player.server;
  var id = player.id;

  //get rid of the player object

  servers[serverId].removePlayer(id);

  if(countPlayers(serverId) === 0){

    //if no players remaining, delete the entire server

    servers[serverId].extract();

    delete servers[serverId];

  } else {

    //if there are still players, just notify players that someone has left

    //module.exports.notifyAlert(serverId, 'notif', [0, name, countActivePlayers(serverId)]);

  }

}

function countPlayers(serverId){

  return servers[serverId].getPlayerCount();

}

function countActivePlayers(serverId){

  var i, count = 0, playerList = servers[serverId].players;

  for(i in playerList){

    var player = playerList[i];

    if(player.gaming){

      count++;

    }

  }

  return count;

}

function setDistanceConst(){

  var i, distances = [], increment = 14;

  for(i = 0; i < 100; i++){

    increment *= .998;

    var dist = Math.trunc(125 + (increment * i));

    distances.push(dist);

  }

  return distances;

}

function getProximityObj(xc, yc, proximity){

  //get object with different proximity values

  var negX = xc - proximity,
      posX = xc + proximity,
      negY = yc - proximity,
      posY = yc + proximity;

  return {

    pnx: negX,
    ppx: posX,
    pny: negY,
    ppy: posY

  };

}

function proximityCheck(proximityObject, comparisonObject){

  //see if comparisonObject is within range of proximityObject

  if(proximityObject.pnx < comparisonObject.xc &&
     comparisonObject.xc < proximityObject.ppx &&
     proximityObject.pny < comparisonObject.yc &&
     comparisonObject.yc < proximityObject.ppy){

    return true;

  }

  return false;

}

console.log("server online");
