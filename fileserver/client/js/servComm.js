
/*

initial server communication to get player id

*/

Game.setServHandlers = function(){

  socket.on('id', function(data){

    Game.setupGameData(data);

  });

  socket.on('pong', function(data){

    //data param is time in miliseconds since last server message

    Game.latency = data;

    if(settings.showFps){

      //latency = data;

      textFields["latency"].text = "ping - " + Game.latency + " ms";

    }

  });

  /*

  socket.on('re') and socket.on('rt') pair with Game.sendNetworkPing() and Game.findNetworkTimeAvg()
  in order to find the time offset between client and server

  */

  socket.on('re', function(){

    //find latency of one-way trip

    var now = Date.now();

    Game.commLatency = (now - Game.commLatency) / 2;

    //send time request

    Game.clientTime = Date.now();

    socket.emit('tr');

  });

  socket.on('rt', function(data){

    Game.pushLatencyData(data);

  });

  /*

  recieving new location of main player

  */

  socket.on('message', function(data){

    var xc = data[0], yc = data[1], servTime = data[2];

    players[Game.main].updateToServerPosition(xc, yc, servTime);

  });

  /*

  recieving new respawn location of main player
  (have to tween camera to new location)

  */

  socket.on('newPos', function(data){

    var newX = data[0],
        newY = data[1],
        electronDataMatrix = data[2],
        neutronDataMatrix = data[3],
        playerDataMatrix = data[4],
        servTime = data[5];

    var lag = Game.getLatency(servTime);

    Game.initElectrons(electronDataMatrix);
    Game.initNeutrons(neutronDataMatrix);
    Game.initEnemies(playerDataMatrix);

    players[Game.main].updateToSpawnPoint(newX, newY);

    //un-blur canvas

    //GameUI.blurCanvas(false);

  });

  /*

  recieving data to construct an enemy

  */

  socket.on('enemConst', function(data){

    var localEnem = Game.createEnemy(data);

  });

  /*

  recieving data on enemy location

  */

  socket.on('enem', function(data){

    var i, j, d = data.length;

    var lag = Game.getLatency(data[0]);

    //data has three values (x, y, and id) of each enemy appended onto array
    //jump by threes (starting at index 1 since index 0 has timestamp)

    for(i = 1; i < d; i += 3){

      var newX = data[i],
          newY = data[i + 1],
          id = data[i + 2];

      var enemy = players[id];

      if(enemy){

        //they are already on screen, interpolate

        enemy.updateToServerPosition(newX, newY, lag);

      } else {

        //we're recieving data for a player we do not recognize
        //request info on that player from server

        socket.emit('enemyReq', id);

      }

    }

  });

  /*

  deleting an enemy player

  */

  socket.on('delPl', function(data){

    if(players[data]){

      players[data].remove();

    }

  });

  /*

  a player explodes

  */

  socket.on('plExpl',function(data){

    //first three elements are location objects, fourth (index 3) is id of player

    var i, id = data[3], sourcePlayer;

    if(players[id]){

      Visuals.playerExplosion(data, players[id]);

    }

  });

  /*

  recieving data to construct an electron

  */
  /*
  socket.on('console', function(data){

    console.log(Object.keys(electrons).length + ' - ' + data);

  });
  */
  socket.on('eleConst', function(binData){

    var data = Game.bufferToArray(binData);

    if(data.length === 6){

      //shorter array signifies a free electron

      Game.createFreeElectron(data);

    } else {

      //longer array signifies an orbiting electron

      Game.createOrbitalElectron(data);

    }

  });

  /*

  updating positions for all electrons on screen

  */

  socket.on('ele', function(binData){

    var data = Game.bufferToArray(binData);

    //Game.markElectrons();

    var i, d = data.length;

    //increment by threes to go index by index

    for(i = 0; i < d; i += 3){

      //then loop through all electrons

      var id = data[i], newX = data[i + 1], newY = data[i + 2];

      if(electrons[id]){

        electrons[id].xc = newX;
        electrons[id].yc = newY;
        electrons[id].serverMatch = true;

      } else {

        //we couldnt find this electron, and server thinks we have it
        //request data about electron from server

        socket.emit('electronReq', id);

      }

    }

    //Game.deleteUnMarkedElectrons();

  });

  /*

  fixing the direction of electrons in orbit after refocusing on the screen
  this is because electrons in orbit will ignore typical updates from 'ele' event
  and when user leaves window, frame rate will drop, causing orbital electrons to
  move improperly,

  this will fix them upon refocusing

  */

  socket.on('orbitUpdate', function(binData){

    //update electron position

    var data = Game.bufferToArray(binData);

    players[Game.main].orbitCount = data[0];
    Visuals.updateOrbit();

    var i, j, d = data.length;

    for(i = 1; i < d; i += 4){

      var id = data[i], xc = data[i + 1], yc = data[i + 2], dir = data[i + 3];

      if(electrons[id]){

        electrons[id].xc = xc;
        electrons[id].yc = yc;
        electrons[id].dir = dir;

      } else {

        socket.emit('eRequest', id);

      }

    }

  });

  /*

  player gets an electron in their orbit (either main player or enemy)
  do not construct new electron, just put this one in orbit

  */

  socket.on('elOrb', function(data){

    var i,
        id = data[0],
        dirIncrement = data[1],
        cw = data[2],
        dist = data[3],
        dir = data[4],
        origin = data[5],
        color = data[6],
        dx = data[7],
        dy = data[8],
        xc = data[9],
        yc = data[10];

    if(electrons[id]){

      electrons[id].orbit(dirIncrement, cw, dist, dir, origin, color, dx, dy, xc, yc);

      if(origin === Game.main){

        players[Game.main].orbitCount++;
        Visuals.updateOrbit();
        electrons[id].mainOrbit = true;

      }

    }

  });


  /*

  free array of electrons
  array passed is 2d

  */

  socket.on('free', function(data){

    var i, j, e = electrons.length, d = data.length;

    for(i = 0; i < d; i++){

      var id = data[i][0], xc = data[i][1], yc = data[i][2], dx = data[i][3], dy = data[i][4];

      if(electrons[id]){

        electrons[id].xc = xc;
        electrons[id].yc = yc;
        electrons[id].dx = dx;
        electrons[id].dy = dy;

        electrons[id].free();

      }

    }

  });


  /*

  electron gets fired from main player

  */

  socket.on('fired', function(data){

    var id = data[0], dx = data[1], dy = data[2], xc = data[3], yc = data[4];

    if(electrons[id]){

      electrons[id].mainOrbit = false;
      electrons[id].fire(dx, dy, xc, yc);

    }

  });


  /*

  delete electron thats out of range

  */

  socket.on('eleDel', function(data){

    if(electrons[data]){

      electrons[data].remove();

    }

  });

  /*

  electron either hits a wall too fast or is fired out of bounds
  either way, put explosion effect on it

  */

  socket.on('eXpl', function(data){

    if(electrons[data]){

      electrons[data].explode();

    }

  });

  socket.on('eSlow', function(data){

    var id = data[0], dx = data[1], dy = data[2];

    if(electrons[id]){

      electrons[id].setSlowdownSpeed(dx, dy);

    }

  });

  socket.on('fixDist', function(binData){

    var data = Game.bufferToArray(binData);

    var i, d = data.length;

    for(i = 0; i < d; i += 3){

      var id = data[i],
          distance = data[i + 1],
          dir = data[i + 2];

      if(electrons[id]){

        electrons[id].dirIncrement = dir;

        createjs.Tween.get(electrons[id]).to({dist: distance}, 350, createjs.Ease.cubicOut);

      }

    }

  });

  /*

  when player gains electron decrease maxSpeed

  */

  socket.on('electronObtained', function(data){

    players[Game.main].maxSpeed = data[0];
    Game.scaleArena(data[1]);

  });

  /*

  when player fires an electron, their orbit count and max speed is changed

  */

  socket.on('electronFired', function(data){

    players[Game.main].maxSpeed = data[0];
    players[Game.main].orbitCount = data[1];
    Game.scaleArena(data[2]);

  });

  socket.on('zoom', function(data){

    Game.scaleArena(data);

  });

  /*

  update amount of electrons player sees is in orbit (in hud)

  */

  socket.on('oUpd', function(data){

    players[Game.main].orbitCount = data;

  });

  /*

  update prositions of (or create) neutrons

  *//*

  socket.on('nUpd', function(binData){

    var data = Game.bufferToArray(binData);

    Game.markNeutrons();

    var i, d = data.length;

    //increment by threes to go index by index

    for(i = 0; i < d; i += 3){

      //then loop through all electrons

      var id = data[i], newX = data[i + 1], newY = data[i + 2];

      if(neutrons[id]){

        neutrons[id].xc = newX;
        neutrons[id].yc = newY;
        neutrons[id].serverMatch = true;

      }

    }

    Game.deleteUnMarkedNeutrons();

  });
  */
  socket.on('newNeutron', function(binData){

    var data = Game.bufferToArray(binData);

    Game.createNeutron(data);

  });

  /*

  delete a neutron
  may pass a player id if neutron is absored by a player, play animation

  */

  socket.on('nDel', function(data){

    var neutronId = data[0], playerId = data[1];

    if(neutrons[neutronId]){

      neutrons[neutronId].clear(playerId);

    }

  });


  /*

  player gets a neutron and their max orbit increases, play animation

  */

  socket.on('maxOrbit', function(data){

    //run the animation

    textFields["scoreAmount"].text = " + " + data[1];

    Visuals.orbitIncreaseAnimation();

    //update actual text fields

    players[Game.main].orbitMax = data[0];

    Visuals.updateOrbit();

  });

  /*

  main player dies

  */

  socket.on('dead', function(data){

    Game.eliminated();

    var timeAlive = data.timeAlive,
        allKills = data.atoms,
        maxOrbit = data.maxOrbit,
        topPlace = data.place + 1;

    var totalSeconds = Math.round(timeAlive / 1000);
    var totalMinutes = 0;

    if(totalSeconds < 0){

      totalSeconds *= -1;

    }

    while(totalSeconds >= 60){

      totalSeconds -= 60;
      totalMinutes++;

    }

    $("#atoms").text(allKills);
    $("#place").text(topPlace);
    $("#orbit").text(maxOrbit);

    if(totalSeconds < 10){

      $("#time").text(totalMinutes + ':0' + totalSeconds);

    } else {

      $("#time").text(totalMinutes + ':' + totalSeconds);

    }

  });

  /*

  place on leaderboard

  */

  socket.on('place', function(data){

    if(settings.showBoard){

      var place = data + 1;

      if(players[Game.main].name === ""){

        textFields["mainPlayer"].text = place + ". " + "you";

      } else {

        textFields["mainPlayer"].text = place + ". " + players[Game.main].name;

      }

      cacheStage.update();

    }

  });

  socket.on('topPlace', function(data){

    if(settings.showBoard){

      var d = data.length, i;
      var leaderBoardArr = textFields["leaderboard"];

      for(i = 0; i < d; i++){

        var name = data[i].name;
        var score = data[i].score;
        var color = data[i].color;

        //take text field index and add six (to get text field within leaderboard)

        if(name === ""){

          //player has no name

          name = "unnamed";

        }

        leaderBoardArr[i].text = (i + 1) + ". " + name + " (" + score + ")";
        leaderBoardArr[i].color = Visuals.getCSSColor(color);

      }

      cacheStage.update();

    }

  });

  socket.on('info', function(data){

    console.log(data);

  });


  /*

  handle notifications

  */

  /*

  socket.on('notif', function(data){

    Visuals.getNotificationData(data);

  });

  */


}
