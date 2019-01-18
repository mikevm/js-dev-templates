const gulp = require('gulp');
const sass = require('gulp-sass');
const gulp_remove_logging = require('gulp-remove-logging');
const webpackStream = require('webpack-stream');
const webpack = require('webpack');
const eslint = require('gulp-eslint');
const wpMerge = require('webpack-merge');
const _ = require('lodash');
const hash = require('gulp-hash');

require('events').EventEmitter.defaultMaxListeners = 40;
require('babel-polyfill');

const commonCssNames = _.map([
  'global.scss',
  'common.scss',
  'bootstrap_overrides.scss',
  'jquery_overrides.scss',
], (o) => __dirname + '/public/css/' + o + '.scss');

let allWebpackDevTasks = [];
const apps = [
  { name: 'page1' },
  { name: 'page2' },
  { name: 'page_with_css_dependency'
    dependencies: [ 'public_common.scss' ] }
];

const allWebpackProdTasks = [];
const allScssTasks = [];
const allWatchTasks = [];
const outputDir = __dirname + '/public/jsapps/';

apps.forEach((o) => {
  const n = o.name,
        webpackDevTaskName = 'webpack:' + n + ':dev',
        webpackProdTaskName = 'webpack:' + n + ':prod',
        scssTaskName = 'scss:' + n;

  gulp.task(webpackDevTaskName, () => {
    var config = webpackDevConfig(n);
    config.entry = ['babel-polyfill', __dirname + '/public/js/' + n + '/app_' + n + '.js'];

    return gulp.src(__dirname + '/public/js/' + n + '/app_' + n + '.js')
      .pipe(webpackStream( config ))
      .pipe(hash())
      .pipe(gulp.dest(outputDir))
      .pipe(hash.manifest(outputDir + 'manifest.json', { space: '  ', deleteOld: true, sourceDir: outputDir }))
      .pipe(gulp.dest('.'));
  });

  gulp.task(webpackProdTaskName, () => {
    var config = webpackProdConfig(n);
    config.entry = ['babel-polyfill', __dirname + '/public/js/' + n + '/app_' + n + '.js'];
    return gulp.src(__dirname + '/public/js/' + n + '/app_' + n + '.js')
      .pipe(gulp_remove_logging({}))
      .pipe(webpackStream( config ))
      .pipe(hash())
      .pipe(gulp.dest(outputDir))
      .pipe(hash.manifest(outputDir + 'manifest.json', { space: '  ', deleteOld: true, sourceDir: outputDir }))
      .pipe(gulp.dest('.'));
  });

  gulp.task(scssTaskName, () => {
    return gulp.src(__dirname + '/public/css/' + n + '.scss')
      .pipe(sass({ outputStyle: 'compressed' }).on('error', sass.logError))
      .pipe(hash())
      .pipe(gulp.dest(outputDir))
      .pipe(hash.manifest(outputDir + 'manifest.json', { space: '  ', deleteOld: true, sourceDir: outputDir }))
      .pipe(gulp.dest('.'));
  });

  gulp.task('watch:' + n, [webpackDevTaskName, scssTaskName], () => {
    gulp.watch(
      [ __dirname + '/public/js/*',
        __dirname + '/public/js/common/**/*',
        __dirname + '/public/js/' + n + '/**/*' ],
      [ webpackDevTaskName ]
    );
    gulp.watch(getWatched(n, 'scss'), [ scssTaskName ]);
  });
    
  allWebpackDevTasks.push('webpack:' + n + ':dev');
  allWebpackProdTasks.push('webpack:' + n + ':prod');
  allScssTasks.push('scss:' + n);
  allWatchTasks.push('watch:' + n);
});

gulp.task('webpack:dev', allWebpackDevTasks);
gulp.task('webpack:prod', allWebpackProdTasks);
gulp.task('scss', allScssTasks);
gulp.task('watch', allWatchTasks);

var runLint = (fileSrc) => {
  return gulp.src(fileSrc)
    .pipe(eslint())                 // Run ESLint
    .pipe(eslint.format())          // Display Output on Screen
    .pipe(eslint.failAfterError()); // On error exit the process with error code (1)
};

gulp.task('lint', () => {
  return runLint([
    __dirname + '/**/*.js'
  ]);
});

gulp.task('all:dev', ['lint', 'webpack:dev', 'scss']);
gulp.task('all:prod', ['lint', 'webpack:prod', 'scss']);

function webpackCommonConfig(appName) {
  return {
    output: {
      filename: appName + '.js'
    },
    module: {
      loaders: [
        { test: /\.hbs$/, loader: __dirname + '/node_modules/handlebars-loader?helperDirs[]=' + __dirname + '/public/js/hbs_helpers' },
        { test: /\.json$/, loader: 'json-loader' },
        { test: /\.js$/, loader: 'babel-loader', query: { presets: ['es2015'] } }
      ]
    }
  };
}

function webpackDevConfig(appName) {
  return wpMerge(webpackCommonConfig(appName), {
    devtool: 'cheap-module-source-map',
    plugins: [
      new webpack.LoaderOptionsPlugin({
        minimize: false,
        debug: true
      }),
      new webpack.DefinePlugin({
        'process.env': {
          'NODE_ENV': JSON.stringify('development')
        }
      })
    ]
  });
}

function webpackProdConfig(appName) {
  return wpMerge(webpackCommonConfig(appName), {
    plugins: [
      new webpack.LoaderOptionsPlugin({
        minimize: true,
        debug: false
      }),
      new webpack.DefinePlugin({
        'process.env': {
          'NODE_ENV': JSON.stringify('production')
        }
      }),
      new webpack.optimize.UglifyJsPlugin({
        beautify: false,
        mangle: {
          screw_ie8: true,
          keep_fnames: true
        },
        compress: {
          screw_ie8: true,
          warnings: false
        },
        comments: false
      })
    ]
  });
}
  
const getWatched = (appName, type) => {
  let files = [],
      appConfig = apps.filter(a => a.name === appName)[0];

  if (type === 'scss') {
    files.push(appName + '.scss');
    commonCssNames.forEach(s => files.push(s));
    (appConfig.dependencies || [])
      .filter(s => s.endsWith('.scss'))
      .forEach(s => files.push(s));
    return files.map(o => __dirname + '/public/css/' + o);
  } else if (type === 'js') {
    console.error('NYI');
  }
};

