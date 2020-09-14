
//add behavior to buttons

$("#startBtn").click(function(){

  if(Game.available){

    Game.joinGame();
    GameUI.toggleScreen(GameUI.mainMenu, 350);

  }

});

$("#settings").click(function(){

  GameUI.switchScreen(GameUI.mainMenu, GameUI.settingsMenu);

});

$("#skins").click(function(){

  GameUI.switchScreen(GameUI.mainMenu, GameUI.skinsMenu);

});

$("#skinsBack").click(function(){

  GameUI.switchScreen(GameUI.skinsMenu, GameUI.mainMenu);

});

$("#settingsBack").click(function(){

  GameUI.switchScreen(GameUI.settingsMenu, GameUI.mainMenu);

});

$("#statsContinue").click(function(){

  GameUI.switchScreen(GameUI.statsMenu, GameUI.mainMenu);

  setTimeout(function(){

    Game.currentScreen = 0;
    Game.available = true;

  }, 500);

  Game.startInstructions();

});

$("#leftCtrl").click(function(){

  Game.userColor--;

  if(Game.userColor < 0){

    Game.userColor = Game.imgTotal;

  }

  GameUI.displayImg();

});

$("#rightCtrl").click(function(){

  Game.userColor++;

  if(Game.userColor > Game.imgTotal){

    Game.userColor = 0;

  }

  GameUI.displayImg();

});

$(document).keypress(function(e){

  //enter press has different behavior depending on screen
  //currentScreen, 0 = main, -1 = no keyboard controls available

    if(e.which === 13){

      if(Game.currentScreen === 0 && Game.available){

        e.preventDefault();

        Game.joinGame();
        GameUI.toggleScreen(GameUI.mainMenu, 350);

      }

    }

});


//ui closure
//mainly deals with jquery so we dont mix technologies in the Game closure

var GameUI = {

  //set screen names as properties
  mainMenu: "#mainNav",
  settingsMenu: "#settingsNav",
  skinsMenu: "#skinsNav",
  statsMenu: "#statsNav",

  //if user can switch screens (so they cant reactive buttons while in-transition)
  switchAvailable: true,

  //animation time for screen switch
  fadeTime: 200,

  instructionIndex: 0,
  instructions: [

    'try to capture electrons in your orbit without hitting them',
    'use a mouse-click to shoot electrons at other players',
    'when you click, the electron closest to your mouse cursor will be fired',
    'collect neutrons by getting close to them, this will increase your orbit',
    'when you fire an electron, it will glow and be unobtainable for two seconds',
    'you cannot capture electrons already in another player\'s orbit',

  ],

  switchScreen: function(currentScreen, nextScreen){

    if(GameUI.switchAvailable){

      //disable switching

      GameUI.switchAvailable = false;

      //change currentScreen to enable enter-presses

      if(nextScreen === GameUI.mainMenu){

        Game.currentScreen = 0;

      } else {

        Game.currentScreen = -1;

      }

      //toggle screens

      $(currentScreen).fadeToggle(GameUI.fadeTime);

      setTimeout(function(){

        $(nextScreen).fadeToggle(GameUI.fadeTime);

      }, GameUI.fadeTime/2);

      setTimeout(function(){

        GameUI.switchAvailable = true;

      }, GameUI.fadeTime);

    }

  },

  //toggleScreen - for opening or closing

  toggleScreen: function(targetScreen, fadeTime){

    if(GameUI.switchAvailable){

      GameUI.switchAvailable = false;

      $(targetScreen).fadeToggle(fadeTime);

      setTimeout(function(){

        GameUI.switchAvailable = true;

      }, fadeTime);

    }

  },
/*
  blurCanvas: function(blurIn){

    var blur = {};

    if(blurIn){

      blur.val = 0;

      createjs.Tween.get(blur).to({val: 12}, 750, createjs.Ease.linear);

      setTimeout(function(){

        Game.setFPS(66);

      }, 1000);

    } else {

      blur.val = 12;

      createjs.Tween.get(blur).to({val: 0}, 750, createjs.Ease.linear);

      Game.setFPS(66);

    }

    var blurInterval = setInterval(function(){

      blur.string = 'blur(' + blur.val + 'px)';

      GameUI.setCanvasBlur(blur.string);

    }, 1000/66);

    setTimeout(function(){

      clearInterval(blurInterval);

      //ensure bluring is at appropriate value once interval is finished

      if(blurIn){

        GameUI.setCanvasBlur();

        //once finished bluring in, allow user to join again

        Game.available = true;

      } else {

        GameUI.clearCanvasBlur();

      }

    }, 750);

  },

  clearCanvasBlur: function(){

    $('.gameStage')
      .css('filter', "")
      .css('webkitFilter', "")
      .css('mozFilter', "")
      .css('oFilter', "")
      .css('msFilter', "");

  },

  setCanvasBlur: function(blur){

    $('.gameStage')
      .css('filter', blur)
      .css('webkitFilter', blur)
      .css('mozFilter', blur)
      .css('oFilter', blur)
      .css('msFilter', blur);

  },
*/
  resetInstructions: function(){

    $('#instructions').text(GameUI.instructions[0]);

    GameUI.instructionIndex = 0;

    $('#instructions').fadeTo(750, 0.25);

  },

  changeInstructions: function(){

    $('#instructions').fadeTo(750, 0);

    GameUI.instructionIndex++;

    if(GameUI.instructionIndex > (GameUI.instructions.length - 1)){

      GameUI.instructionIndex = 0;

    }

    setTimeout(function(){

      var newTextIndex = GameUI.instructionIndex;

      $('#instructions').text(GameUI.instructions[newTextIndex]);

      $('#instructions').fadeTo(750, 0.25);

    }, 1000);

  },

  getUserName: function(){

    var tempName = $('#name').val();

    if(tempName.length > 30){

      players[Game.main].name = tempName.substring(0, 30) + "...";

    } else {

      players[Game.main].name = tempName;

    }

  },

  defaultSettings(){

    //some settings enabled by default

    $("#showNames").prop("checked", true);
    $("#showBoard").prop("checked", true);

  },

  handleFPSSettings: function(){

    if($('#showFPS').prop('checked')){

      settings.showFps = true;

    } else {

      settings.showFps = false;
      textFields["fps"].text = "";
      textFields["latency"].text = "";

    }

  },

  handleNameSettings: function(){

    if($('#showNames').prop('checked')){

      settings.showNames = true;
      Game.showNames();

    } else {

      settings.showNames = false;
      Game.hideNames();

    }

  },

  handleBoardSettings: function(){

    if($('#showBoard').prop('checked')){

      settings.showBoard = true;

    } else {

      settings.showBoard = false;

      textFields["mainPlayer"].text = "";
      textFields["playerFirst"].text = "";
      textFields["playerSecond"].text = "";
      textFields["playerThird"].text = "";

    }

  },
/*
  handleNotificationSettings: function(){

    settings.showNotifications = false;

    if($('#notifications').prop('checked')){

      settings.showNotifications = true;

    } else {

      settings.showNotifications = false;

      var i, n = notifications.length;

      for(i = 0; i < n; i++){

        containers.hud.removeChild(notifications[i]);

      }

    }

  },

  */

  handleQualitySettings: function(){

    var qualityInput = $("#quality").val();

    quality = parseInt(qualityInput);

    Game.quality = quality;

    switch(quality){

      //high

      case 0:

        console.log('high');

        Game.xNative = 1920;
    		Game.yNative = 1080;

      break;

      //med

      case 1:

        console.log('med');

        Game.xNative = 1280;
        Game.yNative = 720;

      break;

      //low

      case 2:

        console.log('low');

        Game.xNative = 843;
        Game.yNative = 480;

      break;

      default:

        Game.xNative = 1920;
        Game.yNative = 1080;

    }

    Game.setResolutionScaling();

  },

  displayImg: function(){

    switch(Game.userColor){

      case 0:

        $("#skinImg").attr("src", "/client/img/blue.svg");

      break;

      case 1:

        $("#skinImg").attr("src", "/client/img/red.svg");

      break;

      case 2:

        $("#skinImg").attr("src", "/client/img/purple.svg");

      break;

      case 3:

        $("#skinImg").attr("src", "/client/img/green.svg");

      break;

      case 4:

        $("#skinImg").attr("src", "/client/img/lightblue.svg");

      break;

      case 5:

        $("#skinImg").attr("src", "/client/img/orange.svg");

      break;

      case 6:

        $("#skinImg").attr("src", "/client/img/gold.svg");

      break;

      default:

        $("#skinImg").attr("src", "/client/img/blue.svg");

        Game.userColor = 0;

    }

  },

};
