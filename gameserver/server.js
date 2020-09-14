
var game = require('./app');
var Electron = require('./electron.js');
var Neutron = require('./neutron.js');
var Bot = require('./bots.js');

module.exports = class Server {

  constructor(id, electronCount, arenaSize, distanceArr){

    this.players = {};
    this.neutrons = {};

    this.electrons = [];
    this.leaderboard = [];

    this.id = id;
    this.electronCount = electronCount;
    this.arenaSize = arenaSize;
    this.playerOrbitalDistances = distanceArr;

  }

  addPlayer(id, player){

    this.players[id] = player;

  }

  removePlayer(id){

    delete this.players[id];

  }

  getPlayerCount(){

    var i, total = 0;

    for(i in this.players){

      //disregarding bots

      if(!this.players[i].bot){

        total++;

      }

    }

    return total;

  }

  getPlayerBotCount(){

    //total of players and bots

    var i, total = 0;

    for(i in this.players){

      total++;

    }

    return total;

  }

  extractBot(maxPlayers){

    var playerLength = this.getPlayerBotCount();

    if(playerLength >= maxPlayers){

      var i;

      for(i in this.players){

        if(this.players[i].bot){

          //disable a bot

          this.players[i].willRespawn = false;

          //just disable one, then stop

          return;

        }

      }

    }

  }

  initServer(maxPlayers){

    //create all electrons and neutrons for server

    var i;

    for(i = 0; i < this.electronCount; i++){

      var electron = new Electron(this.id, i, this.arenaSize);

      electron.startFreeMove();

      this.electrons.push(electron);

    }

    for(i = 0; i < 50; i++){

      var id = Math.random();

      var neutron = new Neutron(0, 0, 0, 0, this.id, id, 1);

      neutron.randomizeSpawn();
      neutron.randomizeDelta();
      neutron.init();

      this.neutrons[id] = neutron;

    }

    //start leaderboard interval

    this.leaderboardInterval = setInterval(() => this.leaderboardSend(), 1000);

    //create some bots to take places of (a few) real players until they join
    //fill up to 1/3 of server max

    var botCount = Math.round(maxPlayers/3);

    for(i = 0; i < (botCount - 1); i++){

      this.createBot();

    }

  }

  createBot(){

    var id = Math.random();

    var bot = new Bot(id, this.id);

    this.addPlayer(id, bot);

    bot.add();
    bot.randomMouse();

  }

  clearSenderId(id){

    var i;

    for(i = 0; i < this.electronCount; i++){

      if(this.electrons[i].sendId === id){

        this.electrons[i].sendId = -1;

      }

    }

  }

  extract(){

    var i;

    //disable electrons and neutrons, clear intervals, prepare for entire server to be deleted

    for(i = 0; i < this.electronCount; i++){

      this.electrons[i].clear();

    }

    for(i in this.neutrons){

      this.neutrons[i].clear();

    }

    //clear all remaining bots

    for(i in this.players){

      this.players[i].clearIntervals();

    }

    clearInterval(this.leaderboardInterval);

  }

  leaderboardSend(){

    this.leaderboard = this.leaderboardSort();
    var topBoard, i, j, lb;

    //send only top three players

    lb = this.leaderboard.length;

    if(lb > 7){

      topBoard = this.leaderboard.slice(0, 7);

    } else {

      topBoard = this.leaderboard;

    }

    if(typeof topBoard !== 'undefined'){

      for(i in this.players){

        var player = this.players[i];

        //skip if player doesnt exist or they havent started playing yet

        if(player.gaming){

          //send player top three players on leaderboard

          var socket = player.socket;

          socket.emit('topPlace', topBoard);

          //find players individual place on leaderboard

          for(j = 0; j < lb; j++){

            if(this.leaderboard[j].id === player.id){

              player.setLeaderboardPlace(j);
              socket.emit('place', j);

            }

          }

        }

      }

    }

  }

  leaderboardSort(){

    //sort leaderboard by how many electrons a player has in orbit

    var leaderboard = [], i;

    for(i in this.players){

      var player = this.players[i];

      leaderboard.push({

        name: player.name,
        score: player.inOrbit,
        color: player.color,
        id: player.id

      });

    }

    leaderboard.sort(function(a, b) {

      return b.score - a.score;

    });

    return leaderboard;

  }

}
