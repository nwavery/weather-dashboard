# Keep Glance widget receiver + worker entry points (referenced from the manifest
# / WorkManager by name). Release builds are not minified by default here, but
# these rules keep things safe if you enable R8.
-keep class com.weatherglance.widget.** { *; }
-keep class com.weatherglance.MainActivity { *; }
