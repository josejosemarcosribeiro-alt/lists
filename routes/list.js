const express = require('express');
const router = express.Router();
const multer = require('multer');
const multerS3 = require('multer-s3');
const AWS = require('aws-sdk');
require('dotenv').config(); // ler .env para as chaves S3

// bring in models
let list_item = require('../models/listitem');
let User = require('../models/user');

// Configurar AWS S3
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});
const s3 = new AWS.S3();

// Configuração do Multer-S3
const upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: process.env.AWS_BUCKET_NAME,
        acl: 'public-read',
        key: function (req, file, cb) {
            cb(null, Date.now() + '-' + file.originalname);
        }
    })
});

// --- ROTAS --- //

// Add new item
router.get('/add', ensureAuthenticated, function(req,res){
    res.render('add_list');
});

router.post('/add', ensureAuthenticated, upload.single('video'), function(req,res){
    req.checkBody('title','Title is required').notEmpty();
    req.checkBody('body','Body is required').notEmpty();

    let errors = req.validationErrors();
    if(errors){
        res.render('add_list', { errors: errors });
    } else {
        let item = new list_item();
        item.title = req.body.title;
        item.author = req.user._id;
        item.body = req.body.body;

        if(req.file){
            item.videoPath = req.file.location; // URL pública do S3
        }

        item.save(function(err){
            if(err){
                console.log(err);
                return;
            } else {
                req.flash('success','Listing Added!');
                res.redirect('/');
            }
        });
    }
});

// Edit item page
router.get('/item/edit/:id', ensureAuthenticated, function(req, res){
    list_item.findById(req.params.id, function(err, item){
        if(item.author != req.user._id){
            req.flash('danger','Not authenticated');
            res.redirect('/');
        } else {
            res.render('edit_item', { item: item });
        }
    });
});

// Edit item action
router.post('/edit/:id', ensureAuthenticated, upload.single('video'), function(req,res){
    let item = {};
    item.title = req.body.title;
    item.author = req.user._id;
    item.body = req.body.body;

    if(req.file){
        item.videoPath = req.file.location; // atualiza vídeo no S3
    }

    let query = {_id: req.params.id};
    list_item.updateOne(query, item, function(err){
        if(err){
            console.log(err);
            return;
        } else {
            req.flash('success','Listing Edited!');
            res.redirect('/');
        }
    });
});

// Get item
router.get('/item/:id', function(req, res){
    list_item.findById(req.params.id, function(err, item){
        if(err){ console.log(err); }
        else {
            User.findById(item.author, function(err, user){
                res.render('item', {
                    item: item,
                    author: user.name
                });
            });
        }
    });
});

// Delete item
router.delete('/item/:id', function(req,res){
    let query = {_id:req.params.id};
    if(!req.user._id){
        res.status(500).send();
    }
    list_item.findById(req.params.id, function(err, item){
        if(item.author != req.user._id){
            res.status(500).send();
        } else {
            list_item.remove(query, function(err){
                if(err) console.log(err);
                res.send('Success');
            });
        }
    });
});

// --- Função de autenticação --- //
function ensureAuthenticated(req,res,next){
    if(req.isAuthenticated()){
        return next();
    } else {
        req.flash('danger','Please login');
        res.redirect('/users/login');
    }
}

module.exports = router;
