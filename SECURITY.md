# Security Policy

## Reporting Security Issues

If you discover a security vulnerability in Arcon, please report it privately
rather than opening a public GitHub issue.

**Do not** include the following in bug reports or pull requests:

- personal conversations
- personal memory databases
- credentials or API keys
- local inference data
- private datasets

These are sensitive materials and should never be shared in a public repository.

## Reporting

Please report security issues to the project maintainer:

- **Email:** vedant.milind.deshpande@gmail.com

If a private security reporting channel is not available through GitHub
Security Advisories, use the email address above.

Please include:
- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix if available

The maintainer will acknowledge reports promptly and work with you to assess
and resolve the issue.

## Scope

This policy applies to the Arcon runtime, memory system, inference service,
and all associated tooling.

## Notes

Arcon is a local-first system. Many security concerns relate to local data
protection, SQLite file permissions, and inference service exposure. Contributors
should treat personal runtime data as sensitive and avoid including it in any
public submission.
