/*
 * LD_PRELOAD shim for running the Bedrock Dedicated Server in containers
 * without IPv6 support (no /proc/net/if_inet6). BDS insists on binding its
 * v6 game port and exits with a misleading "Port may be in use" when the
 * kernel answers EAFNOSUPPORT. No client ever connects during headless
 * tests, so we hand BDS a plain IPv4 socket dressed up as IPv6 and pretend
 * every v6-specific operation succeeded.
 *
 * Built automatically by tests/lib/bedrock.mjs when needed:
 *   gcc -shared -fPIC -O2 -o ipv6shim.so ipv6shim.c
 */
#define _GNU_SOURCE
#include <sys/socket.h>
#include <netinet/in.h>
#include <dlfcn.h>
#include <errno.h>
#include <string.h>

static unsigned char fake_v6[65536];

static int (*real_socket)(int, int, int) = 0;
static int (*real_bind)(int, const struct sockaddr *, socklen_t) = 0;
static int (*real_setsockopt)(int, int, int, const void *, socklen_t) = 0;

int socket(int domain, int type, int protocol) {
  if (!real_socket) real_socket = dlsym(RTLD_NEXT, "socket");
  if (domain == AF_INET6) {
    int fd = real_socket(AF_INET, type, protocol == IPPROTO_IPV6 ? 0 : protocol);
    if (fd == -1 && errno == EAFNOSUPPORT) fd = real_socket(AF_INET, type, 0);
    if (fd >= 0 && fd < (int)sizeof(fake_v6)) fake_v6[fd] = 1;
    return fd;
  }
  return real_socket(domain, type, protocol);
}

int bind(int fd, const struct sockaddr *addr, socklen_t len) {
  if (!real_bind) real_bind = dlsym(RTLD_NEXT, "bind");
  if (addr && addr->sa_family == AF_INET6) {
    /* Pretend the v6 bind worked; nothing will ever arrive on it. */
    return 0;
  }
  return real_bind(fd, addr, len);
}

int setsockopt(int fd, int level, int optname, const void *optval, socklen_t optlen) {
  if (!real_setsockopt) real_setsockopt = dlsym(RTLD_NEXT, "setsockopt");
  if (level == IPPROTO_IPV6 && fd >= 0 && fd < (int)sizeof(fake_v6) && fake_v6[fd]) {
    return 0; /* IPV6_V6ONLY and friends: sure, done. */
  }
  return real_setsockopt(fd, level, optname, optval, optlen);
}
