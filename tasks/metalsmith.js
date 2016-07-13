// start a timer
var buildTime = process.hrtime();
var buildTimeDiff = buildTime;
// load environment variables
require('dotenv').load({silent: true});

// process.env.NODE_ENV VARS - default to development
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

// Start the build!
var chalk = require('chalk');
message('Generating EffectiveAltruism.org!',chalk.cyan.inverse,true);
message('Initialising new build...',chalk.dim,true);
// Metalsmith
var Metalsmith = require('metalsmith');
message('Loaded Metalsmith');
// templating
var metadata = require('metalsmith-metadata');
var moment = require('moment');
var ignore      = require('metalsmith-ignore');
// var getSpecials = require('../lib/get-specials').get
var contentful = require('contentful-metalsmith');
var slug = require('slug'); slug.defaults.mode = 'rfc3986';
var copy = require('metalsmith-copy');
var templates  = require('metalsmith-templates');
var inPlace  = require('metalsmith-in-place');
message('Loaded templating');
var lazysizes = require('metalsmith-lazysizes');
// metadata and structure
var branch  = require('metalsmith-branch');
var collections  = require('metalsmith-collections');
var permalinks  = require('metalsmith-permalinks');
var excerpts = require('metalsmith-excerpts');
var pagination = require('metalsmith-pagination');
var navigation = require('metalsmith-navigation');
message('Loaded metadata');
// static file compilation
var parseHTML = require('../lib/parseHTML').parse;
var shortcodes = require('metalsmith-shortcodes');
var concat = require('metalsmith-concat');
var icons = require('metalsmith-icons');
var feed = require('metalsmith-feed');
var headingsIdentifier = require('metalsmith-headings-identifier');
var headings = require('metalsmith-headings');
var striptags = require('striptags');
var htmlEntities = require('html-entities').Html5Entities;
var strip = function (input){
    // strip out HTML & decode entities for using HTML in Jade attributes
    return htmlEntities.decode(striptags(input).replace('&#xA0;',' ').replace('&nbsp;',' '));
}
message('Loaded static file compilation');
// only require in production
if(process.env.NODE_ENV==='staging' || process.env.NODE_ENV==='production'){
    var htmlMinifier = require("metalsmith-html-minifier");
    var uncss = require('metalsmith-uncss');
    var cleanCSS = require('metalsmith-clean-css');
    var sitemap = require("metalsmith-sitemap");
    // var subset = require('metalsmith-subsetfonts')
    message('Loaded production modules');
}
// utility
var fs = require('fs');
var path = require('path');
var extend = require('util')._extend;
var merge = require('merge');
var typogr = require('typogr');
var NotificationCenter = require('node-notifier').NotificationCenter;
var notifier = new NotificationCenter;
// utility global var to hold 'site' info from our settings file, for reuse in other plugins
var site = JSON.parse(fs.readFileSync(path.join(__dirname,'../src/metalsmith/settings/site.json' )).toString());
site.url = site.protocol + site.domain;
message('Loaded utilities...');
message('All dependencies loaded!',chalk.cyan);



// call the master build function
build(1);


//
function build(buildCount){
    buildCount = buildCount || 1;
    if(buildCount>1){
        buildTime = process.hrtime();
        buildTimeDiff = buildTime;
    }

    // hacky solution to share data between Contentful pages and the 'pagination' plugin
    var collectionSlugs = ['ideas']
    var collectionInfo = {
        ideas: {
            title: 'Articles',
            singular: 'article',
            // sortBy: 'date',
            // reverse: false,
            perPage: 10
        },
    }
    var collectionData = {};
    collectionOptions = {};
    var paginationOptions = {};
    collectionSlugs.forEach(function(slug){
        collectionData[slug] = {};
        collectionOptions[slug] = {
            
                pattern: collectionInfo[slug].singular+'/**/*.html',
                sortBy: collectionInfo[slug].sortBy || 'title',
                reverse: collectionInfo[slug].reverse || false,
                metadata: {
                    singular: collectionInfo[slug].singular,
                }
            
        }
        paginationOptions['collections.'+slug] = {
            perPage: collectionInfo[slug].perPage || 100,
            template: './partials/collection-'+slug+'.swig',
            first: slug+'/index.html',
            path: slug+'/page/:num/index.html',
            pageMetadata: collectionData[slug]
        }
    })

    // START THE BUILD!
    var colophonemes = new Metalsmith(__dirname);
    colophonemes
    .use(logMessage('NODE_ENV: ' + process.env.NODE_ENV,chalk.dim,true))
    .use(logMessage('NODE VERSION: ' + process.version,chalk.dim,true))
    .use(logMessage('BUILD TIMESTAMP: ' + moment().format('YYYY-MM-DD @ H:m'),chalk.dim,true))
    .source('../src/metalsmith')
    .destination('../build')
    .use(ignore([
        '**/.DS_Store',
    ]))
 
    // Set up some metadata
    .use(metadata({
        "site": "settings/site.json"
    }))
    // .use(function (files,metalsmith,done){
    //     var meta = metalsmith.metadata();
    //     getSpecials(function(specials){
    //         Object.keys(specials).forEach(function(specialType){
    //             meta[specialType] = specials[specialType];
    //         })
    //         done();
    //     })
    // })
    .use(function (files,metalsmith,done){
        // build a full domain from our settings
        var meta = metalsmith.metadata();
        meta.site.url = meta.site.protocol + meta.site.domain;
        done();
    })
    .use(function (files,metalsmith,done){
        // add defaults to all our contentful source files
        var defaults = {
            space_id: process.env.CONTENTFUL_SPACE,
            limit: 2000,
            permalink_style: true
        }
        Object.keys(files).filter(minimatch.filter('**/*.contentful')).forEach(function(file){
            if(!files[file].contentful){
                throw new Error('File '+ file + ' should have a `contenful` meta key')
            }
            files[file].contentful = merge(true,defaults,files[file].contentful)
        })
        done();
    })
    .use(logMessage('Prepared global metadata'))
    .use(contentful({ 
        "accessToken" : process.env.CONTENTFUL_ACCESS_TOKEN 
    }))
    .use(function (files,metalsmith,done){
        // get rid of the contentful source files from the build
        Object.keys(files).filter(minimatch.filter('**/*.contentful')).forEach(function(file){
            delete files['file'];
        })
        done();
    })
    .use(logMessage('Downloaded content from Contentful'))
    .use(function (files,metalsmith,done){
        // move the contentful 'fields' metadata to the file's global meta
        Object.keys(files).filter(minimatch.filter('**/*.html')).forEach(function(file){
            var meta = files[file];
            // make sure we have contentful data
            if(!meta.data || !meta.data.fields){ 
                return; 
            }
            // add all the 'data' fields to the global meta
            Object.keys(meta.data.fields).forEach(function(key){
                // 'body' and 'bio' are used as main content fields, so add them to the 'contents' key
                if(['body','bio'].indexOf(key)>-1){
                    meta['contents'] = meta.data.fields[key]
                } else {
                    meta[key] = meta.data.fields[key]
                }
                // add date information to the post
                meta.date = meta.date || meta.data.sys.createdAt;
                meta.updated = meta.updated || meta.data.sys.updatedAt;
                meta.contents = meta.contents && meta.contents.length>0 ? meta.contents : '';
                // concat footnotes into main content field
                if(meta.footnotes) {
                    meta.contents = meta.contents + '\n\n' + meta.footnotes;
                    delete meta.footnotes;
                }
            });
        });

        done();
    })
    
    .use(logMessage('Processed Contentful metadata'))
    .use(collections({
        pages: {
            pattern: 'pages/**/index.html',
            sortBy: 'menuOrder',
            metadata: {
                singular: 'page',
            }
        },
        ideas: {
            pattern: 'ideas/**/index.html',
            sortBy: 'menuOrder',
            metadata: {
                singular: 'blog',
            }
        },
        series: {
            pattern: 'series/**/index.html',
            sortBy: 'title',
            metadata: {
                singular: 'series',
            }
        },
        people: {
            pattern: 'people/**/index.html',
            sortBy: 'title',
            metadata: {
                singular: 'person',
            }
        }
    }))
    .use(logMessage('Added files to collections'))
    .use(function (files, metalsmith, done) {
        // check all of our HTML files have slugs
        Object.keys(files).filter(minimatch.filter('**/*.html')).forEach(function(file){
            meta = files[file];
            // add a slug
            if(!meta.slug) {
                if (meta.title) {
                    meta.slug = slug(meta.title)
                }
                else if (meta.name) {
                    meta.slug = slug(meta.name)
                } else {
                    throw new Error ('Could not set slug for file ' + file)
                }
            }
        })
        done();
    })
    .use(function (files,metalsmith,done){
        // move pages from /pages/ into site root
        Object.keys(files).filter(minimatch.filter('pages/**/index.html')).forEach(function(file){
            var newPath = file.replace('pages/','');
            if(newPath==='home/index.html'){
                newPath = 'index.html';
            }
            files[newPath] = files[file];
            delete files[file];
        })
        done();
    })
    .use(function (files,metalsmith,done){
        // use the 'home' template for the home page
        files['index.html'].template = 'home.jade';
        done();
    })
    // .use(function (files,metalsmith,done){
    //     console.log(Object.keys(files))
    // })
    .use(function (files,metalsmith,done){
        // add paths to HTML files
        Object.keys(files).filter(minimatch.filter('**/index.html')).forEach(function(file){
            files[file].path = file!=='index.html' ? file.replace('/index.html','') : '/';
            files[file].canonical = (file!=='index.html' ? '/' : '') + files[file].path + (file!=='index.html' ? '/' : '');
        })
        done();
    })
    .use(branch()
        .pattern('**/*.html') 
        .use(navigation({
            main: {
                includeDirs: true
            }
        },{
            permalinks: true
        }))
    )
    .use(logMessage('Added navigation metadata'))
    .use(function (files, metalsmith, done) {
        // console.log(Object.keys(files['ideas/index.html']));

        // add templates for our collections
        // var collections = ['ideas'];
        // collections.forEach(function(collection){
        //     if(files[collection+'/index.html']){
        //         files[collection+'/index.html'].template = 'collection.jade';
        //     }
        // })
        done();
    })
    .use(function (files, metalsmith, done) {
        var dynamicSiteRedirects = files['settings/_redirects'].contents.toString().split('\n').sort()
        // build a list of redirects from file meta
        var metadata =metalsmith.metadata();
        var redirects = {};
        var redirectsFile = [];
        Object.keys(files).forEach(function (file) {
            if(files[file].redirects){
                files[file].redirects.forEach(function(redirect){
                    if(redirect !== '/'+files[file].path){
                        redirects[redirect] = files[file];
                        redirectsFile.push(redirect + ' /' + files[file].path + ' 301')
                    }
                })
            }
        })

        // inject the list of redirects into the global metadata
        metadata.redirects = redirects;

        // create a _redirects file for Netlify
        redirectsFile.sort();
        dynamicSiteRedirects.sort();
        redirectsFile = redirectsFile.concat(dynamicSiteRedirects);
        files['_redirects'] = {contents:redirectsFile.join('\n')};
        done();
    })
    .use(logMessage('Calculated redirects'))   
    // parse 'series' hierarchy to use file objects from the build
    .use(function (files, metalsmith, done) {
        var defaultItem = {
            file: {},
            type: '',
            children: []
        }
        // create a lookup table of contentful data IDs and metalsmith files
        var fileIDLookup = {};
        Object.keys(files).filter(minimatch.filter('**/*.html')).forEach(function(file){
            fileIDLookup[files[file].data.sys.id] = files[file];
        })
        var series = {};
        // build a hierarchy of item IDs
        Object.keys(files).filter(minimatch.filter('series/**/*.html')).forEach(function(file){
            var s = Object.assign({},defaultItem);
            s.file = fileIDLookup[files[file].data.sys.id];
            s.type = fileIDLookup[files[file].data.sys.contentType.sys.id];
            s.children = getChildren(files[file].data,files[file].slug);
            series[files[file].slug] = s;
        })
        metalsmith.metadata().seriesSet = series;
        done();

        // recursive function to traverse series
        function getChildren(data,seriesSlug){
            var children = [];
            if(data.sys.contentType.sys.id === 'series' && data.fields.items && data.fields.items.length>0){
                data.fields.items.forEach(function(child){
                    var childItem = Object.assign({},defaultItem);
                    childItem.file = fileIDLookup[child.sys.id];
                    if(!childItem) {
                        throw new TypeError('Could not find item with id ' + child.sys.id + '. This may be because the content type of this item is not being requested from Contentful')
                    }
                    childItem.type = childItem.file.data.sys.contentType.sys.id;
                    childItem.children = getChildren(child);
                    children.push(childItem);
                })
            }
            if(seriesSlug){
                children.forEach(function(child,index){
                    // assign series info to original file
                    child.file.series = child.file.series || {};
                    child.file.series[seriesSlug] = {
                        previous: index > 0 ? children[index-1] : false,
                        next: index < children.length-1 ? children[index+1] : false
                    };
                })
            }
            return children;
        }
    })
    .use(logMessage('Built series hierarchy'))
    // Build HTML files
    .use(function (files, metalsmith, done) {
        // parse HTML files
        Object.keys(files).filter(minimatch.filter('**/*.html')).forEach(function(file){
            files[file].contents = parseHTML(files[file].contents.toString(),files[file],{
                redirects: metalsmith.metadata().redirects,
                firstPars: true
            })
            files[file].excerpt = files[file].excerpt ? parseHTML(files[file].excerpt.toString(),files[file],{
                redirects: metalsmith.metadata().redirects
            }) : '';
        })
        done();
    })
    .use(excerpts())
    .use(logMessage('Converted Markdown to HTML'))
    .use(shortcodes({
        'directory': path.normalize(__dirname+'/../src/templates/shortcodes'),
        'pattern': '**/*.html'
    }))
    .use(logMessage('Converted Shortcodes'))
    .use(branch(function(filename,props,i){

            return props.collection && (
                props.collection.indexOf('pages')    > -1 ||
                props.collection.indexOf('ideas') > -1
            );
        })
        .use(headingsIdentifier({
            linkTemplate: "<a class='heading-permalink' href='#%s'><span></span></a>"
        }))
        .use(headings({
            selectors: ['h2,h3,h4']
        }))
        .use(logMessage('Created TOCs'))
    )
    .use(function (files, metalsmith, done) {
        // create matching JSON files for each piece of content
        Object.keys(files).filter(minimatch.filter('**/index.html')).forEach(function(file){
            
            var jsonfile = file!=='index.html' ? file.replace('/index.html','.json') : 'index.json';
            
            var json = {}
            var fields = [
                'contents',
                'id',
                'contentType',
                'title',
                'slug',
                'path',
                'excerpt',
                'headings',
                'date',
                'updated'
            ]
            fields.forEach(function(field){
                if(files[file][field]){
                    json[field] = files[file][field]
                }
            })
            json.contents = json.contents.toString();
            files[jsonfile] = {contents:JSON.stringify(json)}
        })

        done();

    })
    .use(function (files, metalsmith, done) {
        // certain content has been incorporated into other pages, but we don't need them as standalone pages in our final build.
        Object.keys(files).filter(minimatch.filter('@(series|quotations)/**')).forEach(function(file){
            delete files[file];
        });
        done();
    })
    .use(function (files, metalsmith, done) {
        // put the 404 page into the root directory
       if(files['404/index.html']){
            files['404.html'] = files['404/index.html'];
            delete files['404/index.html'];
        };
        done();
    })
    .use(templates({
        engine:'jade',
        directory: '../src/templates',
        pretty: process.env.NODE_ENV === 'development' ? true : false,
        typogr,
        moment,
        strip,
        collectionSlugs,
        collectionInfo,
        environment: process.env.NODE_ENV
    }))
    .use(logMessage('Built HTML files from templates'))
    .use(icons({
        fontDir: 'fonts',
        customIcons: 'fonts/glyphs.json'
    }))
    .use(logMessage('Added icon fonts'))
    .use(lazysizes({
        widths: [100,480,768,992,1200,1800],
        qualities: [ 50, 70, 70, 70, 70, 70],
        backgrounds: ['#banner','.content-block-wrapper','.post-header','.featured-image'],
        ignore: "/images/**",
        ignoreSelectors:'.content-block-content',
        querystring: {
            w: '%%width%%',
            q: '%%quality%%'
        }
    }))
    .use(logMessage('Added responsive image markup'))
    
    // stuff to only do in production
    if(process.env.NODE_ENV==='staging' || process.env.NODE_ENV==='production'){
        colophonemes
        .use(logMessage('Minifying HTML',chalk.dim))
        .use(htmlMinifier('**/*.html',{
            minifyJS: true
        }))
        .use(logMessage('Minified HTML'))
        .use(logMessage('Cleaning CSS files',chalk.dim))
        .use(uncss({
            basepath: 'styles',
            css: ['app.min.css'],
            output: 'app.min.uncss.css',
            removeOriginal: true,
            uncss: {
                ignore: [
                    /collaps/,
                    /nav/,
                    /dropdown/,
                    /modal/,
                    /.fade/,
                    /.in/,
                    /.open/,
                    '.transparent',
                    /lazyload/,
                    /tooltip/,
                    /alert/,
                    /highlighted/,
                ],
                media: ['(min-width: 480px)','(min-width: 768px)','(min-width: 992px)','(min-width: 1200px)']
            }
        }))
        .use(logMessage('Cleaned CSS files'))
        // concat main CSS and icon CSS together and put back in the right place
        .use(concat({
            files: ['styles/app.min.uncss.css','styles/icons.css'],
            output: 'styles/app.min.css',
            keepConcatenated: false
        }))
        .use(logMessage('Concatenated CSS files'))
        .use(cleanCSS({
            cleanCSS: {
                rebase: false,
            }
        }))
        .use(function(files,metalsmith,done){
            // delete sourcemaps from production builds
            // delete settings folder
            Object.keys(files).filter(minimatch.filter('{**/*.map,settings/**}')).forEach(function(file){
                delete files[file];
            });

            done();
        })
        .use(sitemap({
            hostname: site.url,
            omitIndex: true,
            modified: 'data.sys.updatedAt',
        }))
        .use(logMessage('Built sitemap'))
        ;
    }

    // Run build
    colophonemes.use(logMessage('Finalising build')).build(function(err,files){
        var t = formatBuildTime(buildTime);
        if(err){
            message('Build failed!',chalk.red.bold)
            console.trace(err);
            if(process.env.NODE_ENV==='development'){
                notifier.notify({
                    title: 'Build failed!',
                    message: err,
                    appIcon: '',
                    contentImage: path.join(__dirname, 'src', 'images','favicons', 'favicon-96x96.png'), // absolute path (not balloons) 
                    sound: 'Funk',
                    activate: 'com.apple.Terminal'
                })
            }
        }
        if(files){
            message('✓ Build OK!',chalk.green.bold);
            if(process.env.NODE_ENV==='development'){
                notifier.notify({
                    title: 'Website built!',
                    message:'Build time: '+t+'\nClick to switch to Chrome',
                    appIcon: '',
                    contentImage: path.join(__dirname, 'src', 'images','favicons', 'favicon-96x96.png'), // absolute path (not balloons) 
                    sound: 'Glass',
                    activate: 'com.google.Chrome'
                })
                // keep the process running so we don't have to recompile dependencies on subsequent builds...
                /*
                prompt.start()
                prompt.message = "Build again?"
                prompt.get(['response'],function(err,results){
                    if(err) {
                        if(err.message === 'canceled'){
                            console.log('Cancelled')
                            return;
                        } else {
                            throw new Error (err);
                        }
                    }
                    if(results.response.toLowerCase()==='n' || results.response.toLowerCase()==='n'){
                        console.log('Cancelled')
                        return;
                    }
                    build(buildCount+1);
                });*/
            }
        }
    } )
    ;
}




// UTILITIES //

// LOG FILES
function logFilesMap (files, metalsmith, done) {
    Object.keys(files).forEach(function (file) {
        if(file.search('css'))
        console.log(">> ", file);
    });
    done();
};
// SEND CONSOLE MESSAGES
function message(m,c,t){
    c = c||chalk.yellow.bold
    t = t||false;
    var output = c(m);
    if(!t) {
        output += '................................................'.substr(m.length)
        output += chalk.dim('(+'+formatBuildTimeDiff()+' / '+formatBuildTime()+')')
    }
    console.log('-',output);
}
function logMessage (m,c,t){
    c = c ||chalk.bold.blue
    return function(files, metalsmith, done){
        message(m,c,t)
        done();
    }
}
// FORMAT BUILD TIMER INTO Mins : secs . milliseconds
function formatBuildTime(hrTimeObj){
    hrTimeObj = hrTimeObj || buildTime
    var t = process.hrtime(hrTimeObj)
    return (t[0] + (t[1]/10e+9)).toFixed(3)+'s';
}
function formatBuildTimeDiff(){
    var t = buildTimeDiff;
    buildTimeDiff = process.hrtime();
    return formatBuildTime(t);
}

