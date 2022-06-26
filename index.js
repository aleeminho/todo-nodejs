// SETUP
require('dotenv').config();
const express = require('express');

const app = express();
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const _ = require('lodash');
const { v4: uuidv4 } = require('uuid');

const port = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.use(express.static(`${__dirname}/public`));

app.use(session({
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false,
}));

app.use(passport.initialize());
app.use(passport.session());

// DB
mongoose.connect('mongodb://localhost:27017/todoDB');
const userSchema = new mongoose.Schema({
  name: String,
  username: String,
  password: String,
  tasks: [Object],
});

userSchema.plugin(passportLocalMongoose);
const User = mongoose.model('User', userSchema);

passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// ROUTES
app.get('/', (req, res) => {
  res.redirect('/auth/register');
});

app.get('/tasks', (req, res) => {
  if (req.isAuthenticated()) {
    User.findById(req.user.id, (err, user) => {
      if (err) {
        console.log(err);
      } else {
        res.locals.title = 'Todo List';
        res.render('tasks', {
          data: user,
        });
      }
    });
  } else {
    res.redirect('/auth/register');
  }
});

app.post('/addtask', (req, res) => {
  const updateObject = { id: uuidv4(), title: req.body.title, content: req.body.content };
  User.findById(req.user.id, (err, data) => {
    if (err) console.log(err);
    if (data) {
      data.tasks.push(updateObject);
      data.save(() => {
        res.redirect('/tasks');
      });
    }
  });
});

app.get('/edittask/:id/:taskId', (req, res) => {
  User.findById(req.params.id, (err, data) => {
    if (err) console.log(err);
    res.locals.title = 'Edit Task';
    res.render('edittask', { data, filteredTask: data.tasks.find((e) => e.id === req.params.taskId), _ });
  });
});

app.post('/edittask/:id/:taskId', (req, res) => {
  User.updateOne(
    { id: req.params.id, 'tasks.id': req.params.taskId },
    {
      $set: {
        'tasks.$.title': req.body.title,
        'tasks.$.content': req.body.content,
      },
    },
    (err, data) => {
      if (err) console.log(err);
      res.redirect('/tasks');
    },
  );
});

app.post('/deletetask/:id/:taskId', (req, res) => {
  User.findById(req.params.id, (err, data) => {
    if (err) console.log(err);
    console.log(req.params.taskId);
    console.log(data);
    data.tasks.splice(data.tasks.findIndex((e) => e.id === req.params.taskId), 1);
    data.save(() => {
      res.redirect('/tasks');
    });
  });
});

app.route('/auth/login')
  .get((req, res) => {
    res.locals.title = 'Login';
    res.render('login.ejs');
  })
  .post((req, res) => {
    const user = new User({
      username: req.body.username,
      password: req.body.password,
    });

    req.login(user, (err) => {
      if (err) {
        console.log(err);
      } else {
        passport.authenticate('local', { successRedirect: '/tasks', failureRedirect: '/auth/login' })(req, res, () => {
          res.redirect('/tasks');
        });
      }
    });
  });

app.route('/auth/register')
  .get((req, res) => {
    res.locals.title = 'Register';
    res.render('register.ejs');
  })
  .post((req, res) => {
    User.register({ username: req.body.username }, req.body.password, (err, data) => {
      if (err) {
        console.log(err);
        res.redirect('/auth/register');
      } else {
        data.name = req.body.fullName;
        data.save();
        passport.authenticate('local')(req, res, () => {
          res.redirect('/tasks');
        });
      }
    });
  });

app.listen(process.env.PORT || port, () => {
  console.log(`Server is running on port ${port}`);
});
