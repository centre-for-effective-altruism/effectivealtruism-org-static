// start a timer
var buildTime = process.hrtime();
var buildTimeDiff = buildTime;
// load environment variables
require('dotenv').load({silent: true});
// process.env.NODE_ENV VARS - default to development
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
// cache require paths in development
if (process.env.NODE_ENV === 'development') {
    // require('time-require');
    require('cache-require-paths');
}

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
var contentful = require('contentful-metalsmith');
var slug = require('slug'); slug.defaults.mode = 'rfc3986';
var layouts  = require('metalsmith-layouts');
message('Loaded templating');
var lazysizes = require('metalsmith-lazysizes');
// metadata and structure
var branch  = require('metalsmith-branch');
var collections  = require('metalsmith-collections');
var excerpts = require('metalsmith-excerpts');
// var pagination = require('metalsmith-pagination');
var navigation = require('metalsmith-navigation');
message('Loaded metadata');
// static file compilation
var parseHTML = require('../lib/parseHTML').parse;
var shortcodes = require('metalsmith-shortcodes');
var concat = require('metalsmith-concat');
var icons = require('metalsmith-icons');
// var feed = require('metalsmith-feed');
var headingsIdentifier = require('metalsmith-headings-identifier');
var headings = require('metalsmith-headings');
var striptags = require('striptags');
var htmlEntities = require('html-entities').Html5Entities;
var strip = function (input){
    // strip out HTML & decode entities for using HTML in Jade attributes
    function subs(input){
            var substitutions = [
                ['&#xA0;',' '],['&nbsp;', ' ']
            ];
            var i = striptags(input);
            substitutions.forEach(function(substitution){
                i = i.replace(substitution[0],substitution[1]);
            });
            return i;
        
    }
    return htmlEntities.decode(subs(input));

};
var jsFiles = {};
message('Loaded static file compilation');

// only require in development
/*if(process.env.NODE_ENV==='development'){
    var watch = require('glob-watcher');
    var nodeStatic = require('node-static');
    message('Loaded dev modules');
}*/

// only require in production
if(process.env.NODE_ENV==='staging' || process.env.NODE_ENV==='production'){
    var htmlMinifier = require('metalsmith-html-minifier');
    var uncss = require('metalsmith-uncss');
    var cleanCSS = require('metalsmith-clean-css');
    var sitemap = require('metalsmith-sitemap');
    message('Loaded production modules');
}
// utility
var fs = require('fs');
var path = require('path');
var merge = require('merge');
var typogr = require('typogr');
var minimatch = require('minimatch');
var url = require('url');
var NotificationCenter = require('node-notifier').NotificationCenter;
var notifier = new NotificationCenter();
// utility global var to hold 'site' info from our settings file, for reuse in other plugins
var site = JSON.parse(fs.readFileSync(path.join(__dirname,'../src/metalsmith/settings/site.json' )).toString());
site.url = site.protocol + site.domain;
message('Loaded utilities...');
message('All dependencies loaded!',chalk.cyan);



// call the master build function
// build(true);
function build(buildCount){
    return function (done) {
        buildCount = buildCount || 1;
        if(buildCount>1){
            buildTime = process.hrtime();
            buildTimeDiff = buildTime;
        }
        // // hacky solution to share data between Contentful pages and the 'pagination' plugin
        // var collectionSlugs = ['ideas'];
        // var collectionInfo = {
        //     ideas: {
        //         title: 'Articles',
        //         singular: 'article',
        //         // sortBy: 'date',
        //         // reverse: false,
        //         perPage: 10
        //     },
        // };
        // var collectionData = {};
        // var collectionOptions = {};
        // var paginationOptions = {};
        // collectionSlugs.forEach(function(slug){
        //     collectionData[slug] = {};
        //     collectionOptions[slug] = {
                
        //             pattern: collectionInfo[slug].singular+'/**/*.html',
        //             sortBy: collectionInfo[slug].sortBy || 'title',
        //             reverse: collectionInfo[slug].reverse || false,
        //             metadata: {
        //                 singular: collectionInfo[slug].singular,
        //             }
                
        //     };
        //     paginationOptions['collections.'+slug] = {
        //         perPage: collectionInfo[slug].perPage || 100,
        //         template: './partials/collection-'+slug+'.swig',
        //         first: slug+'/index.html',
        //         path: slug+'/page/:num/index.html',
        //         pageMetadata: collectionData[slug]
        //     };
        // });

        // hostnames where we should trigger an embed instead of a straight link
        var embedHostnames = [
            'youtube.com',
            'www.youtube.com',
            'youtu.be',
            'vimeo.com',
        ];

        // shortcodes is used twice so abstract the options object
        var shortcodeOpts = {
            directory: path.normalize(__dirname+'/../src/templates/shortcodes'),
            pattern: '**/*.html',
            engine:'pug',
            extension:'.pug',
            cache: true,
            url,
            typogr,
            slugify: slug,
            moment,
            embedHostnames
        };


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
        ]));


        // Set up some metadata
        colophonemes.use(metadata({
            'site': 'settings/site.json'
        }))
        .use(function (files,metalsmith,done){
            // build a full domain from our settings
            var meta = metalsmith.metadata();
            if(process.env.NODE_ENV === 'staging'){
                meta.site.domain = meta.site.domain.replace('www','staging');
            }
            meta.site.url = meta.site.protocol + meta.site.domain;
            done();
        })
        .use(function (files,metalsmith,done){
            // add defaults to all our contentful source files
            /*eslint-disable */
            var defaults = {
                space_id: process.env.CONTENTFUL_SPACE, 
                limit: 2000,
                permalink_style: true
            };
            /*eslint-enable */
            Object.keys(files).filter(minimatch.filter('**/*.contentful')).forEach(function(file){
                if(!files[file].contentful){
                    throw new Error('File '+ file + ' should have a `contenful` meta key');
                }
                files[file].contentful = merge(true,defaults,files[file].contentful);
            });
            done();
        })
        .use(logMessage('Prepared global metadata'))
        .use(contentful({ 
            'accessToken' : process.env.CONTENTFUL_ACCESS_TOKEN 
        }))
        .use(function (files,metalsmith,done){
            // get rid of the contentful source files from the build
            Object.keys(files).filter(minimatch.filter('**/*.contentful')).forEach(function(file){
                delete files[file];
            });
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
                        meta.contents = meta.data.fields[key] || '';
                    } else {
                        meta[key] = meta.data.fields[key];
                    }
                });
                // add date information to the post
                meta.date = meta.date || meta.data.sys.createdAt;
                meta.updated = meta.updated || meta.data.sys.updatedAt;
                meta.contents = meta.contents && meta.contents.length>0 ? meta.contents : '';

                // concat footnotes into main content field
                if(meta.footnotes) {
                    meta.contents = meta.contents + '\n\n' + meta.footnotes;
                    delete meta.footnotes;
                }

                // remap 'layout' key from text string to filename
                var layoutSubstitutions = {
                    "Basic Page": 'page.pug',
                    "Page with Table of Contents": 'page-with-toc.pug',
                    "Home Page": 'home.pug',
                    "Basic Article": 'article.pug',
                    "Article with Table of Contents": 'article-with-toc.pug',
                }
                if (meta.layout && Object.keys(layoutSubstitutions).indexOf(meta.layout) > -1) {
                    meta.layout = layoutSubstitutions[meta.layout];
                }
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
            articles: {
                pattern: 'articles/**/index.html',
                sortBy: 'menuOrder',
                metadata: {
                    singular: 'article',
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
            },
            'mediaItems': {
                pattern: 'media-items/**/index.html',
                sortBy: 'date',
                reverse: true,
                metadata: {
                    singular: 'media-item',
                }
            }
        }))
        .use(logMessage('Added files to collections'))
        .use(function (files, metalsmith, done) {
            // check all of our HTML files have slugs
            Object.keys(files).filter(minimatch.filter('**/*.html')).forEach(function(file){
                var meta = files[file];
                // add a slug
                if(!meta.slug) {
                    if (meta.title) {
                        meta.slug = slug(meta.title);
                    }
                    else if (meta.name) {
                        meta.slug = slug(meta.name);
                    } else {
                        throw new Error ('Could not set slug for file ' + file);
                    }
                }
            });
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
            });
            // move 404 out of subdirectory
            if(files['404/index.html']){
                files['404.html'] = files['404/index.html'];
                delete files['404/index.html'];
            }
            // move favicons into root directory
            Object.keys(files).filter(minimatch.filter('images/favicons/**')).forEach(function(file){
                files[path.basename(file)] = files[file];
                delete files[file];
            })
            done();
        })
        .use(logMessage('Moved files into place'))
        // .use(function (files,metalsmith,done){
        //     console.log(Object.keys(files))
        // })
        .use(function (files,metalsmith,done){
            // add paths to HTML files
            Object.keys(files).filter(minimatch.filter('**/index.html')).forEach(function(file){
                files[file].path = file!=='index.html' ? file.replace('/index.html','') : '/';
                files[file].canonical = (file!=='index.html' ? '/' : '') + files[file].path + (file!=='index.html' ? '/' : '');
            });
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
            var dynamicSiteRedirects = files['settings/_redirects'].contents.toString().split('\n').sort();
            // build a list of redirects from file meta
            var metadata =metalsmith.metadata();
            var redirects = {};
            var redirectsFile = [];
            Object.keys(files).forEach(function (file) {
                if(files[file].redirects){
                    files[file].redirects.forEach(function(redirect){
                        if(redirect !== '/'+files[file].path){
                            redirects[redirect] = files[file];
                            redirectsFile.push(redirect + ' /' + files[file].path + ' 301');
                        }
                    });
                }
            });

            // inject the list of redirects into the global metadata
            metadata.redirects = redirects;

            // create a _redirects file for Netlify
            redirectsFile.sort();
            dynamicSiteRedirects.sort();
            redirectsFile = redirectsFile.concat(dynamicSiteRedirects);
            files._redirects = {contents:redirectsFile.join('\n')};
            done();
        })
        .use(logMessage('Calculated redirects'))   
        // parse 'series' hierarchy to use file objects from the build
        .use(function (files, metalsmith, done) {
            // create a lookup table of contentful data IDs and metalsmith files
            metalsmith.metadata().fileIDMap = {};
            var fileIDMap = metalsmith.metadata().fileIDMap;
            Object.keys(files).filter(minimatch.filter('**/*.html')).forEach(function(file){
                fileIDMap[files[file].data.sys.id] = files[file];
            });
            done();
        })
        .use(function (files, metalsmith, done) {
            var defaultItem = {
                file: {},
                type: '',
                children: []
            };
            var fileIDMap = metalsmith.metadata().fileIDMap;
            // recursive function to traverse series
            function getChildren(data,seriesSlug){
                var children = [];
                if(data.sys.contentType.sys.id === 'series' && data.fields.items && data.fields.items.length>0){
                    data.fields.items.forEach(function(child){
                        var childItem = Object.assign({},defaultItem);
                        childItem.file = fileIDMap[child.sys.id];
                        if(!childItem.file) {
                            // file is probably archived or unpublished
                            return;
                        }
                        childItem.type = childItem.file.data.sys.contentType.sys.id;
                        childItem.children = getChildren(child);
                        children.push(childItem);
                    });
                }
                if(seriesSlug){
                    children.forEach(function(child,index){
                        // assign series info to original file
                        child.file.series = child.file.series || {};
                        child.file.series[seriesSlug] = {
                            previous: index > 0 ? children[index-1] : false,
                            next: index < children.length-1 ? children[index+1] : false
                        };
                    });
                }
                return children;
            }
            var series = {};
            // build a hierarchy of item IDs
            Object.keys(files).filter(minimatch.filter('series/**/*.html')).forEach(function(file){
                var s = Object.assign({},defaultItem);
                s.file = fileIDMap[files[file].data.sys.id];
                s.type = fileIDMap[files[file].data.sys.contentType.sys.id];
                s.children = getChildren(files[file].data,files[file].slug);
                series[files[file].slug] = s;
            });
            metalsmith.metadata().seriesSet = series;
            done();

        })
        .use(logMessage('Built series hierarchy'))
        // Build HTML files
        .use(function (files, metalsmith, done) {
            // parse HTML files
            Object.keys(files).filter(minimatch.filter('**/*.html')).forEach(function(file){
                files[file].contents = parseHTML(files[file].contents.toString(),files[file],{
                    redirects: metalsmith.metadata().redirects,
                    firstPars: true
                });
                files[file].excerpt = files[file].excerpt ? parseHTML(files[file].excerpt.toString(),files[file],{
                    redirects: metalsmith.metadata().redirects
                }) : '';
            });
            done();
        })
        .use(excerpts())
        .use(logMessage('Converted Markdown to HTML'))
        .use(function (files, metalsmith, done) {
            // certain content has been incorporated into other pages, but we don't need them as standalone pages in our final build.
            Object.keys(files).filter(minimatch.filter('@(series|quotations|links|books|media-items)/**')).forEach(function(file){
                delete files[file];
            });
            done();
        })
        .use(shortcodes(shortcodeOpts))
        .use(logMessage('Converted Shortcodes'))
        .use(branch(function(filename,props){

                return props.collection && (
                    props.collection.indexOf('pages')    > -1 ||
                    props.collection.indexOf('articles') > -1
                );
            })
            .use(headingsIdentifier({
                linkTemplate: '<a class="heading-permalink" href="#%s"><span></span></a>'
            }))
            .use(headings({
                selectors: ['h2,h3,h4']
            }))
            .use(logMessage('Created TOCs'))
        )
        .use(function (files, metalsmith, done) {
            // update shortcodes we haven't processed yet because they don't
            var shortcodes = ['toc'];
            var re = new RegExp('\\[('+shortcodes.join('|')+').*?\\]','gim');
            Object.keys(files).filter(minimatch.filter('**/index.html')).forEach(function(file){
                files[file].contents = files[file].contents.toString().replace(re,function(match,shortcode){
                    return match.replace(shortcode,shortcode+'-parsed');
                });
            });
            done();
        })
        .use(shortcodes(shortcodeOpts))
        .use(logMessage('Converted Shortcodes (2nd pass)'))
        .use(function (files, metalsmith, done) {
            // create matching JSON files for each piece of content
            Object.keys(files).filter(minimatch.filter('**/index.html')).forEach(function(file){
                
                var jsonfile = file!=='index.html' ? file.replace('/index.html','.json') : 'index.json';
                
                var json = {};
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
                ];
                fields.forEach(function(field){
                    if(files[file][field]){
                        json[field] = files[file][field];
                    }
                });
                json.contents = json.contents ? json.contents.toString() : '';
                files[jsonfile] = {contents:JSON.stringify(json)};
            });

            done();

        })
        .use(function (files, metalsmith, done) {
            // copy 'template' key to 'layout' key
            Object.keys(files).filter(minimatch.filter('{**/index.html,404.html}')).forEach(function(file){
                if (files[file].template && !files[file].layout) {
                    files[file].layout = files[file].template;
                } 
                files[file].layout = files[file].layout.replace('.jade','.pug');
            });
            done();
        })
        .use(function (files, metalsmith, done) {
            // get javascript files so we can inline them if needed
            Object.keys(files).filter(minimatch.filter('**/*.js')).forEach(function(file){
                jsFiles[file] = files[file].contents.toString();
            });
            done();
        })
        .use(layouts({
            engine:'pug',
            directory: '../src/templates',
            pretty: process.env.NODE_ENV === 'development' ? true : false,
            cache: true,
            typogr,
            url,
            moment,
            strip,
            jsFiles,
            slugify:slug,
            // collectionSlugs,
            // collectionInfo,
            embedHostnames,
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
            ignore: '/images/**',
            ignoreSelectors:'.content-block-content',
            querystring: {
                w: '%%width%%',
                q: '%%quality%%'
            }
        }))
        .use(logMessage('Added responsive image markup'))
        ;
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
                        /affix/,
                        /active/,
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
                message('Build failed!',chalk.red.bold);
                console.trace(err);
                if(process.env.NODE_ENV==='development'){
                    notifier.notify({
                        title: 'Build failed!',
                        message: err,
                        appIcon: '',
                        contentImage: path.join(__dirname, '..', 'src', 'metalsmith', 'images','favicons', 'favicon-96x96.png'), // absolute path (not balloons) 
                        sound: 'Funk',
                        activate: 'com.apple.Terminal'
                    });
                }
            }
            if(files){
                if(process.env.NODE_ENV==='development'){
                    notifier.notify({
                        title: 'Build succeeded!',
                        message: 'Click to switch to Chrome',
                        appIcon: '',
                        contentImage: path.join(__dirname, '..', 'src', 'metalsmith', 'images','favicons', 'favicon-96x96.png'), // absolute path (not balloons) 
                        sound: 'Glass',
                        activate: 'com.google.Chrome'
                    });
                }
                message('✓ Build OK!',chalk.green.bold);
            }
            if(process.env.NODE_ENV === 'development' && typeof done === 'function'){
                done();
            }
        });
    };
}
// call master build function
build()();

//// DEVELOPMENT RELOADING
// based on example at https://www.npmjs.com/package/metalsmith-changed
/*if(process.env.NODE_ENV === 'development'){
    // server
    var serve = new nodeStatic.Server(path.join(__dirname,'..','build'));
    require('http').createServer((req, res) => {
      req.addListener('end', () => serve.serve(req, res));
      req.resume();
    }).listen(8080);
     // watch files
     message('Watching files');
    watch([
        path.join(__dirname,'..','src','metalsmith','contentful'),
        path.join(__dirname,'..','src','metalsmith','fonts'),
        path.join(__dirname,'..','src','metalsmith','images'),
        path.join(__dirname,'..','src','metalsmith','settings'),
    ], {ignoreInitial: false}, build(2));   
} else {
    build()();
}*/



// UTILITIES //


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
    c = c ||chalk.bold.blue;
    return function(files, metalsmith, done){
        message(m,c,t)
        done();
    };
}
// FORMAT BUILD TIMER INTO Mins : secs . milliseconds
function formatBuildTime(hrTimeObj){
    hrTimeObj = hrTimeObj || buildTime;
    var t = process.hrtime(hrTimeObj);
    return (t[0] + (t[1]/10e+9)).toFixed(3)+'s';
}
function formatBuildTimeDiff(){
    var t = buildTimeDiff;
    buildTimeDiff = process.hrtime();
    return formatBuildTime(t);
}