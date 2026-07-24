const { task, src, dest } = require('gulp');

task('build:icons', copyIcons);

function copyIcons() {
	src('nodes/**/*.{png,svg}', { encoding: false }).pipe(dest('dist/nodes'));

	return src('credentials/**/*.{png,svg}', { encoding: false }).pipe(dest('dist/credentials'));
}
