const autoprefixer = require('autoprefixer');
const cssnano = require('cssnano');

const dev = process.env.NODE_ENV === 'development';

module.exports = {
	// syntax: 'postcss-scss',
	plugins: [
		autoprefixer(),
		!dev &&
			cssnano({
				preset: 'default'
			})
	].filter(Boolean)
};
