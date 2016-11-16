"use strict";

var gulp = require('gulp');
var jshint = require('gulp-jshint');
var mocha = require('gulp-mocha');
//var cover = require('gulp-coverage');
//var coveralls = require('gulp-coveralls');

gulp.task('lint', function () {
    return gulp.src('**/*.js')
        .pipe(jshint())
        .pipe(jshint.reporter('default'))
		.pipe(jshint.reporter('fail'));
});

gulp.task('test', function () {
    return gulp.src(['ut/ut_*.js'], { read: false })
        .pipe(mocha({
            reporter: 'spec',
            globals: {
                // should: require('should')
            }
        }));
});
/*
gulp.task('test2', function () {
    return gulp.src(['ut/ut_*'], { read: false })
        .pipe(cover.instrument({
            pattern: ['tech.js']
        }))
        .pipe(mocha())
        .pipe(cover.gather())
        .pipe(cover.format())
        .pipe(gulp.dest('reports'));
});
*/
gulp.task('default', ['lint']);