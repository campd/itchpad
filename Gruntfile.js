module.exports = function (grunt) {
  require('load-grunt-tasks')(grunt);

  grunt.initConfig({
    watch: {
        files: ['chrome/**/*', 'lib/**/*', 'data/**/*'],
        tasks: ['build'],
        // livereload: true,
        options: {
          // spawn: false,
        }
    },
    shell: {
      xpi: {
        options: {
          stdout: true
        },
        command: "../addon-sdk/bin/cfx xpi"
      },
      postXpi: {
        options: {
          // stdout: true
        },
        command: 'wget --post-file=itchpad.xpi http://localhost:8888/'
      }
    }
  });

  grunt.registerTask('default', []);
  grunt.registerTask('build', ['shell:xpi', 'shell:postXpi']);
}
