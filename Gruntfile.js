module.exports = function (grunt) {
  require('load-grunt-tasks')(grunt);

  grunt.initConfig({
    watch: {
        files: ['chrome/**/*', 'lib/**/*', 'data/**/*'],
        tasks: ['xpi', 'postXpi'],
        // livereload: true,
        options: {
          // spawn: false,
        }
    },
    shell: {
      postXpi: {
        options: {
          // stdout: true
        },
        command: 'wget --post-file=itchpad.xpi http://localhost:8888/'
      }
    },
    "mozilla-addon-sdk": {
      '1_15': {
        options: {
          revision: "1.15",
          dest_dir: "build-tools/"
        }
      }
    },
    "mozilla-cfx-xpi": {
      'stable': {
        options: {
          "mozilla-addon-sdk": "1_15",
          extension_dir: "./",
          dist_dir: "./",
          arguments: "--strip-sdk" // builds smaller xpis
        }
      }
    },
    "mozilla-cfx": {
      'run_stable': {
        options: {
          "mozilla-addon-sdk": "1_15",
          extension_dir: "./",
          command: "run"
        }
      },
      'test': {
        options: {
          "mozilla-addon-sdk": "1_15",
          extension_dir: "./",
          command: "test"
        }
      }
    }
  });

  grunt.registerTask('default', ['mozilla-addon-sdk']);
  grunt.registerTask('xpi', ['mozilla-addon-sdk', 'mozilla-cfx-xpi']);
  grunt.registerTask('postXpi', ['shell:postXpi'])

  // TODO: this is using the wrong binary
  grunt.registerTask('test', ['mozilla-addon-sdk', 'mozilla-cfx:test']);
}
