const express = require('express');
const path  = require('path');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const flash = require('connect-flash');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const config = require('./config/database');

// connect to db
let dburl = process.env.MONGODB_URI || config.database;
mongoose.connect(dburl, { useNewUrlParser: true, useUnifiedTopology: true });
let db = mongoose.connection;
db.once('open', function () {
    console.log('Connected to MongoDB...');
});
db.on('error', function (err) {
    console.log(err);
});

// init app
const app = express();

// bring in models
let list_item = require('./models/listitem');

// load view engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// Body Parser Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// set public folder
app.use(express.static(path.join(__dirname, 'public')));

// Express session middleware
app.set('trust proxy', 1);
app.use(session({
    secret: 'keyboard cat',
    resave: true,
    saveUninitialized: true,
    store: MongoStore.create({ mongoUrl: dburl })
}));

// Connect flash middleware
app.use(flash());
app.use(function (req, res, next) {
    res.locals.messages = require('express-messages')(req, res);
    next();
});

// Passport config
require('./config/passport')(passport);

// Passport Middleware
app.use(passport.initialize());
app.use(passport.session());

// Make user available in templates
app.use('*', function(req, res, next){
    res.locals.user = req.user || null;
    next();
});

// ROUTES
let list = require('./routes/list');     // listas com upload de vídeo
let users = require('./routes/users');   // cadastro 3 etapas
app.use('/list', list);
app.use('/users', users);

// HOME ROUTE
app.get('/', function (req,res) {
    list_item.find({}, function (err, list_items) {
        if(err){
            console.log(err);
            return res.status(500).send('Internal Server Error');
        }
        res.render('index', { list_items: list_items });
    });
});

// ERROR HANDLER GLOBAL
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Internal Server Error');
});

// START SERVER
const port = process.env.PORT || 8080;
app.listen(port, function () {
    console.log(`Server started on port ${port}...`);
});
