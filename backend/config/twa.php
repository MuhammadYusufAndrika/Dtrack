<?php

return [
    /*
    |--------------------------------------------------------------------------
    | TWA / Digital Asset Links
    |--------------------------------------------------------------------------
    | Isi SHA-256 fingerprint dari keystore Android kamu.
    | Ambil via: keytool -list -v -keystore android.keystore
    | Atau dari Play Console > Setup > App integrity.
    | Bisa lebih dari satu (debug + release + Play signing).
    */
    'package' => env('TWA_PACKAGE', 'com.fleetvisionai.twa'),

    'fingerprints' => array_values(array_filter([
        env('TWA_SHA256_1'), // release / upload key
        env('TWA_SHA256_2'), // play signing / debug
    ])),
];
