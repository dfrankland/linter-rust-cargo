# linter-rust-cargo

Rust Cargo linter that's fast.

Lints your Rust files in [Atom][atom], using [`linter`][linter] and `cargo`.

## Install

```bash
apm install linter-rust-cargo
```

Or, go to Settings > Install > Search and type `linter-rust-cargo`.

## Purpose

What makes `linter-rust-cargo` different from [`linter-rust`][linter-rust]? Both
work with `cargo` and have similar functionality and configurability.

`linter-rust-cargo` differentiates itself because:

1.  **It only works with `cargo`.** Focusing only on `cargo` keeps the code
    slim and concise.

2.  **It is very configurable.** It is possible to pass any arguments to the
    `cargo` command, the execution timeout is changeable, `cargo` manifest
    searching is configurable via a glob, and more settings.

2.  **It is pretty fast.** `linter-rust-cargo` does not try to be backwards
    compatible, only works with `cargo`, and is completely asynchronous.

4.  **It displays helpful messages.** Using [`linter`][linter] v2, the errors,
    warnings, and notes from `cargo` as well as `clippy` are utilized to their
    fullest potential. Each message will populate with a title using the code
    and reason for error, a description that includes any notes or suggestions,
    a link to the error index page, and populates any possible solutions (using
    [`intentions`][intentions] or [`linter-ui-default`][linter-ui-default]'s
    `Linter Ui Default: Apply All Solutions` palette command).

[atom]: https://atom.io/
[linter-rust]: https://github.com/AtomLinter/linter-rust
[linter]: https://github.com/atom-community/linter
[intentions]: https://github.com/steelbrain/intentions
[linter-ui-default]: https://github.com/steelbrain/linter-ui-default
