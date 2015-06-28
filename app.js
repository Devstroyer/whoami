var express = require('express')
  , app = express()
  , http = require('http')
  , server = http.createServer(app)
  , io = require('socket.io').listen(server)
  , path = require('path');

server.listen(8080);


app.use(express.static(path.join(__dirname, 'public')));

// routing
app.get('/', function (req, res) {
  res.sendfile(__dirname + '/index.html');
});

// usernames which are currently connected to the chat
var usernames={};
var object = {};
var table = [];

var yes=0;
var no=0;
var maybe=0;
var finish=0;
var upquest='';

var currentplayer=0;

//0 - setting, 1 - asking, 2-waiting, 3- answering
var currentphase=0;

io.sockets.on('connection', function (socket) {

  // when the client emits 'sendchat', this listens and executes
  socket.on('sendchat', function (data) {
    // we tell the client to execute 'updatechat' with 2 parameters
    io.sockets.emit('updatechat', socket.username, data);
  });

  // when the client emits 'adduser', this listens and executes
  socket.on('adduser', function(username){

    var guessing=false;
    if(table.length==0){
      guessing=true;
      currentplayer=0;
    }

    object={
      "name":username,
      "character":"",
      "points":0,
      "guessing":guessing,
      "id":socket.id,
      "round":1
    }
    table.push(object);

    io.to(table[currentplayer].id).emit('setguessing',0);

    socket.emit('setmyself',object);
    socket.emit('uppyta',upquest);
    socket.emit('refresh',table);
    io.sockets.emit('updateusers', table);
    socket.emit('getphase',currentphase);


    
    // we store the username in the socket session for this client
    socket.username = username;
    // add the client's username to the global list
    usernames[username] = username;
    // echo to client they've connected
    // echo globally (all clients) that a person has connected
    socket.broadcast.emit('updatechat', 'SERVER', username + ' się połączył');
    // update the list of users in chat, client-side
   

   // io.to(object.id).emit('message', 'for your eyes only');
  });



  socket.on('setchar', function (data) {
     table[currentplayer].character=data;
     currentphase=1;
     io.sockets.emit('getphase', currentphase);
     io.sockets.emit('updateusers', table);
  });

  socket.on('ask', function (data) {
     currentphase=2;
     upquest=data;
     socket.broadcast.emit('question',data);
     io.sockets.emit('getphase', currentphase);
     yes=0;
     no=0;
     maybe=0;
     finish=0;
  });


//ODPOWIEDZII!!!!!!!
  socket.on('tak', function (data) {
     yes++;
     if(yes>=table.length/2){
       currentphase=1;
       io.sockets.emit('getphase', currentphase);
        io.to(table[currentplayer].id).emit('addhistory','yes');
     }
  });


  socket.on('nie', function (data) {
     no++;
     if(no>=table.length/2){
       table[currentplayer].guessing=false;
       if(table[currentplayer].round<10){
          table[currentplayer].round++;
       }
       
       io.to(table[currentplayer].id).emit('addhistory','no');


        if(currentplayer==table.length-1){
          currentplayer=0;
        }
        else{
          currentplayer++;
        }


        if(table[currentplayer].character===''){
          currentphase=0;
        }
        else{
          currentphase=1;          
        }
        table[currentplayer].guessing=true;
        io.sockets.emit('refresh',table);
        io.to(table[currentplayer].id).emit('setguessing',0);
        io.sockets.emit('getphase', currentphase);
     }
  });

  
  socket.on('moze', function (data) {
    maybe++;
    if(maybe>=table.length/2){
       io.to(table[currentplayer].id).emit('addhistory','maybe');
       currentphase=1;
       io.sockets.emit('getphase', currentphase);
    }
     
  });


   socket.on('finish', function (data) {
    finish++;
    if(finish>=table.length/2){
       table[currentplayer].guessing=false;
       var points=100-((table[currentplayer].round-1)*10);
       table[currentplayer].points+=points;
       table[currentplayer].round=1;
       io.to(table[currentplayer].id).emit('setlast',table[currentplayer].character);
       table[currentplayer].character="";


        if(currentplayer==table.length-1){
          currentplayer=0;
        }
        else{
          currentplayer++;
        }


        if(table[currentplayer].character===''){
          currentphase=0;
        }
        else{
          currentphase=1;          
        }
        table[currentplayer].guessing=true;
        io.sockets.emit('refresh',table);
        io.to(table[currentplayer].id).emit('setguessing',0);
        io.sockets.emit('getphase', currentphase);
    }
     
  });





  // when the user disconnects.. perform this
  socket.on('disconnect', function(){
    // remove the username from global usernames list
    delete usernames[socket.username];

    var index = -1;
    for(var i = 0, len = table.length; i < len; i++) {
      if (table[i].name === socket.username) {
          index = i;
          break;
      }
    }
    if(index!=-1){
      if(table[index].guessing){
        currentphase=0;
        
        if(table.length>(index+1) && table.length>1){
          table[index+1].guessing=true;
          currentplayer=index;
          io.to(table[index+1].id).emit('setguessing',0); 
        }
        else{
          table[0].guessing=true;
          currentplayer=0;
          io.to(table[0].id).emit('setguessing',0);
         
        }
      }
      else{
        if(index<currentplayer){
          currentplayer--;
        }
      }

      table.splice(index, 1);
    }
    io.sockets.emit('refresh',table);
    io.sockets.emit('getphase',currentphase);

    console.log(currentphase);
    // update list of users in chat, client-side
    io.sockets.emit('updateusers', table);
    // echo globally that this client has left
    socket.broadcast.emit('updatechat', 'SERVER', socket.username + ' się rozłączył');
  });
});