/*eslint-env node */

const gulp = require('gulp');
const $ = require('gulp-load-plugins')({lazy: true});
const browserSync = require('browser-sync').create();

const log = require('fancy-log');
const colors = require('ansi-colors');
const del = require('del');

const runseq = require('run-sequence');

const watchify = require('watchify');
const babelify = require('babelify');
const browserify = require('browserify');

const source = require('vinyl-source-stream');
const buffer = require('vinyl-buffer');
const mergeStream = require('merge-stream');
const compress = require('compression');

const babelConfig = { presets: ['es2015'] };
const argv = require('yargs').argv;
const env = argv.env || 'dev';

let config = require('./config/' + env + '.js');
let jsBundles = {};

gulp.task('default', function(done) {
  const gulpPlugins = Object.keys($).reduce((plugins, plugin) => [...plugins, `'${plugin}'`], []).join(', ');
  log('Available gulp plugins:', colors.bold(colors.cyan(gulpPlugins)));
  log(`Running development server at port ${config.port}`);
  runseq('lint', 'clean', 'setup-env', ['styles', 'templates', 'images', 'scripts'], 'watch', 'dev-server', done);
});

gulp.task('lint', function() {
  return gulp.src(['src/js/**/*.js', 'src/sw.js'])
    .pipe($.eslint())
    .pipe($.eslint.format())
    .pipe($.eslint.failOnError());
});

gulp.task('clean', function() {
  return del('dist/**', { force: true });
});

gulp.task('setup-env', function() {
  config = require('./config/' + env + '.js');
  log(colors.yellow('Setting env: ' + env));
  return gulp.src('config/' + env + '.js')
    .pipe($.rename('env.config.js'))
    .pipe(gulp.dest('src'));
});

gulp.task('setup-prod', function() {
  config = require('./config/prod.js');
  log(colors.yellow('Setting env: prod'));
  return gulp.src('config/prod.js')
    .pipe($.rename('env.config.js'))
    .pipe(gulp.dest('src'));
});

gulp.task('templates', function() {
  return gulp.src(['./src/*.html', './src/manifest.json'])
    .pipe(gulp.dest('dist'))
    .pipe(browserSync.stream())
    .on('error', log);
});

gulp.task('scripts', function() {
  jsBundles = {
    'js/polyfills/url.js': createBundle('src/js/polyfills/url.js'),
    'js/polyfills/promise.js': createBundle('src/js/polyfills/promise.js'),
    'js/main.js': createBundle('src/js/main.js'),
    'js/restaurant_info.js': createBundle('src/js/restaurant_info.js'),
    'js/dbhelper.js': createBundle('src/js/dbhelper.js'),
    'env.config.js': createBundle('src/env.config.js'),
    'sw.js': createBundle('src/sw.js')
  };
  return mergeStream.apply(null, Object.keys(jsBundles).map(function(key) {
    return compileBundle(jsBundles[key], key);
  }));
});

gulp.task('images', function() {
  const responsiveOpts = {
    '*.{gif,jpg}': [
      {
        skipOnEnlargement: true,
        flatten: true,
        format: 'jpeg',
      },
      {
        skipOnEnlargement: true,
        flatten: true,
        format: 'jpeg',
        quality: 60,
        width: 500,
        rename: { suffix: '-small' }
      },
      {
        skipOnEnlargement: true,
        flatten: true,
        format: 'jpeg',
        quality: 60,
        width: 800,
        rename: { suffix: '-medium' }
      }
    ],
  };
  const iconOpts = {
    'icon.png': [
      {
        withoutEnlargement: true,
        width: 192,
        height: 192,
        rename: { suffix: '-192x192' }
      },
      {
        withoutEnlargement: true,
        width: 256,
        height: 256,
        rename: { suffix: '-256x256' }
      },
      {
        withoutEnlargement: true,
        width: 384,
        height: 384,
        rename: { suffix: '-384x384' }
      },
      {
        rename: { suffix: '-512x512' }
      }
    ]
  };
  const iconSrc = gulp.src(['src/img/icon.png'], { base: 'src/img/' })
    .pipe($.responsive(iconOpts))
    .pipe(gulp.dest('dist/img'));
  const imagesSrc = gulp.src(['src/img/*.jpg'], { base: 'src/img/' })
    .pipe($.responsive(responsiveOpts))
    .pipe(gulp.dest('dist/img'))
    .pipe($.webp())
    .pipe(gulp.dest('dist/img'));
  return mergeStream.apply(null, [iconSrc, imagesSrc]);
});

gulp.task('styles', function() {
  browserSync.notify('Compiling styles...');
  return gulp.src('src/scss/**/*.scss')
    .pipe($.sass.sync().on('error', $.sass.logError))
    .pipe($.autoprefixer({ browsers: ['last 2 versions']}))
    .pipe($.sourcemaps.init())
    .pipe($.sass({ outputStyle: 'compressed' }))
    .pipe($.sourcemaps.write('.'))
    .pipe(gulp.dest('dist/css'))
    .pipe(browserSync.stream({ match: '**/*.css', once: true }));
});

gulp.task('watch', function() {

  gulp.watch('./src/scss/**/*.scss', ['styles']);
  gulp.watch('./src/*.html', ['templates']).on('change', browserSync.reload);

  Object.keys(jsBundles).forEach(function(key) {
    var b = jsBundles[key];
    b.on('update', function() {
      return compileBundle(b, key);
    });
  });

});

gulp.task('dev-server', function() {
  browserSync.init({
    injectChanges: true,
    server: './dist',
    port: config.port,
    middleware: function(req,res,next){
      var gzip = compress();
      gzip(req,res,next);
    }
  });
  return browserSync.stream();
});

gulp.task('build', function(done) {
  log.info(colors.bold(colors.yellow('Building production files...')));
  runseq('lint', 'clean', 'setup-prod', ['styles', 'templates', 'images', 'scripts'], done);
});

gulp.task('transpile', function() {
  return gulp.src(['src/js/**/*.js'])
    .pipe($.sourcemaps.init())
    .pipe($.babel(babelConfig))
    .on('error', log)
    .pipe($.sourcemaps.write('.'))
    .pipe(gulp.dest('dist'));
});

function createBundle (src) {
  if (!src.push) {
    src = [src];
  }

  var customOpts = {
    entries: src,
    debug: true
  };

  var opts = Object.assign({}, watchify.args, customOpts);
  var bundler = config.prod
    ? browserify(opts).transform(babelify.configure(babelConfig))
    : watchify(browserify(opts)).transform(babelify.configure(babelConfig));

  bundler.on('log', log);
  // b.transform(hbsfy);
  return bundler;
}

function compileBundle(bundler, sourceName) {
  log(colors.yellow('Compiling bundle... ' + sourceName));
  browserSync.notify('Compiling bundle... ' + sourceName);
  return bundler.bundle()
    .on('error', log)
    .pipe(source(sourceName))
    .pipe(buffer())
    .pipe($.sourcemaps.init({ loadMaps: true }))
    .pipe($.uglify())
    .pipe($.sourcemaps.write('.'))
    .pipe(gulp.dest('dist'))
    .pipe(browserSync.stream());
}