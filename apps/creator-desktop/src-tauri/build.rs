fn main() {
    // The updater endpoint is baked in at compile time via `option_env!` (see
    // src/updater.rs). Cargo does not track environment variables read that way,
    // so without these directives, changing the owner/repo and rebuilding would
    // silently reuse the cached binary and ship the OLD endpoint.
    println!("cargo:rerun-if-env-changed=PARTNERA_UPDATE_OWNER");
    println!("cargo:rerun-if-env-changed=PARTNERA_UPDATE_REPO");

    tauri_build::build()
}
