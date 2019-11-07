var express = require("express");
var app = express();
var bodyParser = require("body-parser");
var mongoose = require("mongoose");
var multer =  require("multer");
var path   =  require("path");
var  Product = require("./models/product");
var  Comment = require("./models/comment");
var  Chat    = require("./models/chat");
var passport = require("passport"); 
var LocalStrategy = require("passport-local");
var User          = require("./models/user");
var methodOverride = require("method-override");
var flash          = require("connect-flash");
var server    = app.listen(3000);
var io      = require("socket.io").listen(server);
var users   = {};

var storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'public/uploads')
    },
    filename: (req, file, cb) => {
      cb(null, file.fieldname + '-' + Date.now() + '.jpg')
    }
});
var upload = multer({storage: storage});

mongoose.connect("mongodb://localhost/cart_db");
app.use(bodyParser.urlencoded({extended:true}));
app.use(express.static(__dirname + '/public'));   //this line is very important as it help us to use files from public directory
app.use(methodOverride("_method"));
app.use(flash());

app.set("view engine", "ejs");



//PASSPOKRT CONFIGURATION
app.use(require("express-session")({
    secret: "this is my minor project",
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use(function(req, res, next){
    res.locals.currentUser = req.user;
    res.locals.error     = req.flash("error");
    res.locals.success     = req.flash("success");
    next();
});

app.get("/", function(req,res){
    res.render("home");
});

//INDEX ROUTE- shows all the products available
app.get("/products", function(req,res){

    //get all the products and send them to products page
    Product.find({}, function(err, allproducts){
        if(err){
            console.log(err);
        }else {
          res.render("product/products", {products: allproducts});
        }
    });
    
});

app.post("/products", isLoggedIn, upload.single('image'), function(req, res){
    var name = req.body.name;
    var image = '/uploads/' + req.file.filename;
    var description = req.body.description;
    var price = req.body.price;
    var email = req.body.email;
    var author = {
        id: req.user._id,
        username: req.user.username
    }
    var newProduct = {name:name, image:image, description:description, price:price, author:author, email:email};
    Product.create(newProduct, function(err, newelyCreated){
        if(err){
            console.log(err);
        } else{
            req.flash("success", "Happy Selling, Your Product is Added");
            res.redirect("/products");
        }
    });
});

//create route- add new product to the database
app.get("/products/new", isLoggedIn, function(req, res){
    res.render("product/new");
});

//show route-  Gives information about a particular product- it should be below the create route because :id can get treated like new

app.get("/products/:id", function(req, res){
    //find the product and show them
    Product.findById(req.params.id).populate("comments").exec(function(err, foundProduct){
        if(err){
            console.log(err);
        } else{
            res.render("product/show", {product: foundProduct});
        }
    });
});



app.delete("/products/:id/del2", checkProductOwner, function(req, res){
    Product.findByIdAndDelete(req.params.id, function(err){
        if(err){
            console.log("Lag gae banho");
            res.redirect("/products");
        } else{
            res.redirect("/products/new");
        }
    });
});


app.delete("/products/:id", checkProductOwner, function(req, res){
    Product.findByIdAndDelete(req.params.id, function(err){
        if(err){
            console.log("Lag gae banho");
            res.redirect("/products");
        } else{
            res.redirect("/products");
        }
    });
})

//+++++++++++++++++++++++++++++++++++++++++++++++

app.get("/products/:id/comments/new", isLoggedIn, function(req, res){
    //find the products
    Product.findById(req.params.id, function(err, product){
        if(err){
            console.log(err);
        } else{
            res.render("comment/new", {product: product});
        }
    });
});

app.post("/products/:id/comments", isLoggedIn, function(req, res){
    //find the product by id
    Product.findById(req.params.id, function(err, product){
        if(err){
            console.log(err);
            res.redirect("/products");
        } else{
            Comment.create(req.body.comment, function(err, comment){
                if(err){
                    req.flash("error", "Something Went Wrong");
                    console.log(err);
                } else{
                    //add username and id
                    // req.user.username- this can be used to get the username
                    comment.author.id = req.user._id;
                    comment.author.username = req.user.username;
                    //save comment
                    comment.save();
                    product.comments.push(comment);
                    product.save();
                    req.flash("success", "Comment Added");
                    res.redirect("/products/" + product._id);
                }
            }); 
        }
    });
});




//AUTH ROUTES
app.get("/register", function(req, res){
    res.render("register");
});

//handle signup logic
app.post("/register", function(req, res){
    var newUser = new User({username: req.body.username});
    User.register(newUser, req.body.password, function(err, user){
        if(err){
            req.flash("error", err);
            console.log(err);
            return res.render("register");
        }
        passport.authenticate("local")(req, res, function(){
            req.flash("success", "Welcome to Cart @Lnct " + user.username);
            res.redirect("/products");
        });  
    });
});

//login form
app.get("/login", function(req, res){
    res.render("login");
});

app.post("/login", passport.authenticate("local", 
    {
        successRedirect: "/products",
        failureRedirect: "/login"
    }), function(req, res){
});

app.get("/logout", function(req, res){
    req.logout();
    req.flash("success", "Logged You Out!!!!");
    res.redirect("/products");
});

app.get("/help", function(req, res){
    res.render("chatbot");
});


//=======================================
//Chat app section
//=======================================

app.get("/chat", isLoggedIn, function(req, res){
    res.render("chat", {currentUser: req.user});
});



//the below code will turn on the connection event and this is the first thing a client does i.e turns onn a connection 
io.sockets.on("connection", function(socket){
    socket.on("new user", function(data, callback){
        if (data in users){
            callback(false);
        } else{
            callback(true);
            socket.nickname = data;
            users[socket.nickname] = socket;
            updateNicknames();
        }
    });

    function updateNicknames(){
        io.sockets.emit("usernames", Object.keys(users));
    }

    socket.on("send message", function(data, callback){
        //the below code is to replicate wishper functionallity in which a user  
        var msg = data.trim();
        if(msg.substr(0,3) === '/w '){
            msg = msg.substr(3);
            //here we check wheather user have endered a message in the message box or left it blank
            var ind = msg.indexOf(' ');
            if(ind !== -1){
                var name = msg.substring(0, ind);
                var msg  = msg.substring(ind + 1);
                if(name in users){
                    users[name].emit('wishper', {msg: msg, nick: socket.nickname});
                    console.log('Wishper!');
                } else{
                    callback('Error! Enter a valid user.');
                }  
            } else{
                callback("Error! Please enter a message for your wishper");
            }
        } else{
            io.sockets.emit("new message", {msg: data, nick: socket.nickname}); //message is sint to all the users includng me
        }
        // socket.broadcast.emit('new message', data); message is sent to all the users excluding me
    });

    //the below code is for removing a user if he/she left the database
    socket.on("disconnect", function(data){
        if(!socket.nickname) return;
        delete users[socket.nickname];
        updateNicknames();
    });
});

function isLoggedIn(req, res, next){
    if(req.isAuthenticated()){
        return next();
    }
    req.flash("error", "You eequrie to be logged in to do That");
    res.redirect("/login");
}

function checkProductOwner(req, res, next){
    if(req.isAuthenticated()){
        Product.findById(req.params.id, function(err, foundProduct){
            if(err){
                req.flash("error", "Product Not available");
                res.redirect("back");
            } else{
                if(foundProduct.author.id.equals(req.user.id)) {
                    next();
                } else{
                    req.flash("error", "Permission Denied");
                    res.redirect("back");
                }
            }
        });
    } else{
       req.flash("error", "You need to be logged in to do that");
       res.redirect("back");
    }
} 

