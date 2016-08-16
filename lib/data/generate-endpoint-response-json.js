#!/bin/sh
':' //; exec "$(command -v nodejs || command -v node)" "$0" "$@"
// ^^^ Lovely polyglot script to permit usage via node _or_ via bash: see
// http://unix.stackexchange.com/questions/65235/universal-node-js-shebang

/**
 * To avoid requiring that auto-discovery be utilized every time the API client
 * is initialized, this library ships with a built-in route definition from a
 * vanilla WordPress REST API installation. That file may be updated by
 * installing the API plugin on a clean WP development instance, with no other
 * plugins running, and downloading the JSON output from `yourwpsite.com/wp-json/`
 * into the "endpoint-response.json" file in this directory.
 *
 * That file can also be generated by running this script against the same live
 * WP REST API instance to download that same file, the difference being that,
 * if the `endpoint-response.json` file is downloaded through this script, it
 * will be run through the `simplifyObject` utility to cut out about 1/3 of the
 * bytes of the response by removing properties that do not effect route generation.
 *
 * This script is NOT intended to be a dependency of any part of wp.js, and is
 * provided purely as a utility for upgrading the built-in copy of the endpoint
 * response JSON file that is used to bootstrap the default route handlers.
 *
 * @example
 *
 *     # Invoke directly, run against default endpoint (details below)
 *     ./generate-endpoint-response-json.js
 *
 *     # Invoke with `node` CLI, run against default endpoint
 *     node ./generate-endpoint-response-json --endpoint=http://my-site.com/wp-json
 *
 * This script runs against http://wpapi.loc/wp-json by default, but it can be
 * run against an arbitrary WordPress REST API endpoint by passing the --endpoint
 * argument on the CLI:
 *
 * @example
 *
 *     # Invoke directly, run against an arbitrary WordPress API root
 *     ./generate-endpoint-response-json.js --endpoint=http://my-site.com/wp-json
 *
 *     # Invoke with `node` CLI, run against an arbitrary WordPress API root
 *     node ./generate-endpoint-response-json --endpoint=http://my-site.com/wp-json
 *
 * Either form will update the `endpoint-response.json` file in this directory,
 * providing that the endpoint data is downloaded successfully.
 *
 * This script also has some utility for downloading a custom JSON file for your
 * own WP REST API-enabled site, so that you can bootstrap your own routes without
 * incurring an HTTP request. To output to a different directory than the default
 * (which is this directory, `lib/data/`), pass an --output argument on the CLI:
 *
 * @example
 *
 *     # Output to your current working directory
 *     ./path/to/this/dir/generate-endpoint-response-json.js --output=.
 *
 *     # Output to an arbitrary absolute path
 *     ./path/to/this/dir/generate-endpoint-response-json.js --output=/home/mordor/output.json
 *
 * These command-line flags may be combined, and you will usually want to use
 * --endpoint alongside --output to download your own JSON into your own directory.
 */
'use strict';

var agent = require( 'superagent' );
var fs = require( 'fs' );
var path = require( 'path' );
var simplifyObject = require( './simplify-object' );

// Parse the arguments object
var argv = require( 'minimist' )( process.argv.slice( 2 ) );

// The output directory defaults to the lib/data directory. To customize it,
// specify your own directory with --output=your/output/directory (supports
// both relative and absolute paths)
var outputPath = argv.output ?
	// Nested ternary, don't try this at home: this is to support absolute paths
	argv.output[ 0 ] === '/' ? argv.output : path.join( process.cwd(), argv.output ) :
	path.dirname( __filename );

// Specify your own API endpoint with --endpoint=http://your-endpoint.com/wp-json
var endpoint = argv.endpoint || 'http://wpapi.loc/wp-json';

// This directory will be called to kick off the JSON download: it uses
// superagent internally for HTTP transport that respects HTTP redirects.
function getJSON( cbFn ) {
	agent
		.get( endpoint )
		.set( 'Accept', 'application/json' )
		.end(function( err, res ) {
			// Inspect the error and then the response to infer various error states
			if ( err ) {
				console.error( '\nSomething went wrong! Could not download endpoint JSON.' );
				if ( err.status ) {
					console.error( 'Error ' + err.status );
				}
				if ( err.response && err.response.error ) {
					console.error( err.response.error );
				}
				return process.exit( 1 );
			}

			if ( res.type !== 'application/json' ) {
				console.error( '\nError: expected response type "application/json", got ' + res.type );
				console.error( 'Could not save endpoint-response.json' );
				return process.exit( 1 );
			}

			cbFn( res );
		});
}

// The only assumption we want to make about the URL is that it should be a web
// URL of _some_ sort, which generally means it has "http" in it somewhere. We
// can't assume much else due to how customizable the location of API root is
// within your WP install.
if ( ! /http/i.test( endpoint ) ) {
	console.error( '\nError: ' + endpoint );
	console.error( 'This does not appear to be a valid URL. Please double-check the URL format\n' +
		'(should be e.g. "http://your-domain.com/wp-json") and try again.' );
	process.exit( 1 );
}

fs.stat( outputPath, function( err, stats ) {
	if ( err || ! stats.isDirectory() ) {
		console.error( '\nError: ' + outputPath );
		console.error( 'This is not a valid directory. Please double-check the path and try again.' );
		process.exit( 1 );
	}

	// If we made it this far, our arguments look good! Carry on.
	getJSON(function( response ) {
		// Extract the JSON
		var endpointJSON = JSON.parse( JSON.stringify( response.body ) );
		var slimJSON = simplifyObject( endpointJSON );

		var outputFilePath = path.join( outputPath, 'endpoint-response.json' );
		fs.writeFile( outputFilePath, JSON.stringify( slimJSON ), function( err ) {
			if ( err ) {
				console.error( '\nSomething went wrong! Could not save ' + outputFilePath );
				return process.exit( 1 );
			}
			console.log( '\nSuccessfully saved ' + outputFilePath );
		});
	});
});