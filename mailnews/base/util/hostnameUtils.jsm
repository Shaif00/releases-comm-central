/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Generic shared utility code for checking of IP and hostname
 * validity.
 */

const EXPORTED_SYMBOLS = [ "isLegalHostNameOrIP",
                           "isLegalHostName",
                           "isLegalIPv4Address",
                           "isLegalIPv6Address",
                           "isLegalIPAddress",
                           "isLegalLocalIPAddress" ];

/**
 * Check if aHostName is an IP address or a valid hostname.
 *
 * @param aHostName                The string to check for validity.
 * @param aAllowExtendedIPFormats  Allow hex/octal formats in addition to decimal.
 * @return  Unobscured host name if aHostName is valid.
 *          Returns null if it's not.
 */
function isLegalHostNameOrIP(aHostName, aAllowExtendedIPFormats)
{
  /*
   RFC 1123:
   Whenever a user inputs the identity of an Internet host, it SHOULD
   be possible to enter either (1) a host domain name or (2) an IP
   address in dotted-decimal ("#.#.#.#") form.  The host SHOULD check
   the string syntactically for a dotted-decimal number before
   looking it up in the Domain Name System.
  */

  return isLegalIPAddress(aHostName, aAllowExtendedIPFormats) ||
         isLegalHostName(aHostName);
}

/**
 * Check if aHostName is a valid hostname.
 *
 * @return  The host name if it is valid.
 *          Returns null if it's not.
 */
function isLegalHostName(aHostName)
{
  /*
   RFC 952:
   A "name" (Net, Host, Gateway, or Domain name) is a text string up
   to 24 characters drawn from the alphabet (A-Z), digits (0-9), minus
   sign (-), and period (.).  Note that periods are only allowed when
   they serve to delimit components of "domain style names". (See
   RFC-921, "Domain Name System Implementation Schedule", for
   background).  No blank or space characters are permitted as part of a
   name. No distinction is made between upper and lower case.  The first
   character must be an alpha character.  The last character must not be
   a minus sign or period.

   RFC 1123:
   The syntax of a legal Internet host name was specified in RFC-952
   [DNS:4].  One aspect of host name syntax is hereby changed: the
   restriction on the first character is relaxed to allow either a
   letter or a digit.  Host software MUST support this more liberal
   syntax.

   Host software MUST handle host names of up to 63 characters and
   SHOULD handle host names of up to 255 characters.
  */

  const hostPattern = /^(([a-z0-9]|[a-z0-9][a-z0-9\-]{0,61}[a-z0-9])\.)*([a-z0-9]|[a-z0-9][a-z0-9\-]{0,61}[a-z0-9])$/i;
  return ((aHostName.length <= 255) && hostPattern.test(aHostName)) ? aHostName : null;
}

/**
 * Check if aHostName is an IPv4 address.
 *
 * @param aHostName                The string to check for validity.
 * @param aAllowExtendedIPFormats  If false, only IPv4 addresses in decimal format
 *                                 will be accepted, no hex/octal formats.
 * @return  Unobscured canonicalized address if aHostName is an IPv4 address.
 *          Returns null if it's not.
 */
function isLegalIPv4Address(aHostName, aAllowExtendedIPFormats)
{
  // Scammers frequently obscure the IP address by encoding each component as
  // octal, hex or in some cases a mix match of each. The IP address could
  // also be represented as a DWORD.

  // Break the IP address down into individual components.
  let ipComponents = aHostName.split(".");

  if (ipComponents.length == 4)
  {
    for (let i = 0; i < ipComponents.length; i++)
    {
      // is the component decimal?
      if (/^(0|([1-9][0-9]{0,2}))$/.test(ipComponents[i])) {
        ipComponents[i] = parseInt(ipComponents[i], 10);
      } else if (aAllowExtendedIPFormats) {
        // is the component octal?
        if (/^(0[0-7]{1,3})$/.test(ipComponents[i]))
          ipComponents[i] = parseInt(ipComponents[i], 8);
        // is the component hex?
        else if (/^(0x[0-9a-f]{1,2})$/.test(ipComponents[i]))
          ipComponents[i] = parseInt(ipComponents[i], 16);
        else
          return null;
      } else {
        return null;
      }
    }
  }
  else if (aAllowExtendedIPFormats)
  {
    // Convert to a binary to test for possible DWORD.
    let binaryDword = parseInt(aHostName).toString(2);
    if (isNaN(binaryDword))
      return null;

    // convert the dword into its component IP parts.
    ipComponents = new Array;
    ipComponents[0] = (aHostName >> 24) & 255;
    ipComponents[1] = (aHostName >> 16) & 255;
    ipComponents[2] = (aHostName >>  8) & 255;
    ipComponents[3] = (aHostName & 255);
  }
  else {
    return null;
  }

  // Make sure each part of the IP address is in fact a number, and that
  // each part isn't larger than 255.
  for (let i = 0; i < ipComponents.length; i++)
  {
    // If any part of the IP address is not a number, or longer than 255,
    // then we can safely return.
    if (isNaN(ipComponents[i]) || ipComponents[i] > 255)
      return null;
  }

  let hostName = ipComponents.join(".");
  // Treat 0.0.0.0 as an invalid IPv4 address.
  return (hostName != "0.0.0.0") ? hostName : null;
}

/**
 * Check if aHostName is an IPv6 address.
 *
 * @param aHostName  The string to check for validity.
 * @return  Unobscured canonicalized address if aHostName is an IPv6 address.
 *          Returns null if it's not.
 */
function isLegalIPv6Address(aHostName)
{
  // Break the IP address down into individual components.
  let ipComponents = aHostName.toLowerCase().split(":");

  // Make sure there are at least 3 components.
  if (ipComponents.length < 3)
    return null;

  let ipLength = ipComponents.length - 1;

  // Take care if the last part is written in decimal using dots as separators.
  let lastPart = isLegalIPv4Address(ipComponents[ipLength], false);
  if (lastPart)
  {
    let lastPartComponents = lastPart.split(".");
    // Convert it into standard IPv6 components.
    ipComponents[ipLength] =
      ((lastPartComponents[0] << 8) | lastPartComponents[1]).toString(16);
    ipComponents[ipLength + 1] =
      ((lastPartComponents[2] << 8) | lastPartComponents[3]).toString(16);
  }

  // Make sure that there is only one empty component.
  let emptyIndex;
  for (let i = 1; i < ipComponents.length - 1; i++)
  {
    if (ipComponents[i] == "")
    {
      // If we already found an empty component return null.
      if (emptyIndex)
        return null;

      emptyIndex = i;
    }
  }

  // If we found an empty component, extend it.
  if (emptyIndex)
  {
    ipComponents[emptyIndex] = 0;

    // Add components so we have a total of 8.
    for (let count = ipComponents.length; count < 8; count++)
      ipComponents.splice(emptyIndex, 0, 0);
  }

  // Make sure there are 8 components.
  if (ipComponents.length != 8)
    return null;

  // Format all components to 4 character hex value.
  for (let i = 0; i < ipComponents.length; i++)
  {
    if (ipComponents[i] == "")
      ipComponents[i] = 0;

    // Make sure the component is a number and it isn't larger then 0xffff.
    if (/^[0-9a-f]{1,4}$/.test(ipComponents[i])) {
      ipComponents[i] = parseInt(ipComponents[i], 16);
      if (isNaN(ipComponents[i]) || ipComponents[i] > 0xffff)
        return null;
    }
    else {
      return null;
    }

    // Pad the component with 0:s.
    ipComponents[i] = ("0000" + ipComponents[i].toString(16)).substr(-4);
  }

  // TODO: support Zone indices in Link-local addresses? Currently they are rejected.
  // http://en.wikipedia.org/wiki/IPv6_address#Link-local_addresses_and_zone_indices

  let hostName = ipComponents.join(":");
  // Treat 0000:0000:0000:0000:0000:0000:0000:0000 as an invalid IPv6 address.
  return (hostName != "0000:0000:0000:0000:0000:0000:0000:0000") ?
          hostName : null;
}

/**
 * Check if aHostName is an IP address.
 *
 * @param aHostName                The string to check for validity.
 * @param aAllowExtendedIPFormats  Allow hex/octal formats in addition to decimal.
 * @return  Unobscured canonicalized IPv4 or IPv6 address if it is valid,
 *          otherwise null.
 */
function isLegalIPAddress(aHostName, aAllowExtendedIPFormats)
{
  return isLegalIPv4Address(aHostName, aAllowExtendedIPFormats) ||
         isLegalIPv6Address(aHostName, aAllowExtendedIPFormats);
}

/**
 * Check if aIPAddress is a local IP address.
 *
 * @param aIPAddress  A valid IP address literal in canonical (unobscured) form.
 * @return            True if it is a local IPv4 or IPv6 address, otherwise false.
 */
function isLegalLocalIPAddress(aIPAddress)
{
  // IPv4 address?
  let ipComponents = aIPAddress.split(".");
  if (ipComponents.length == 4)
  {
     // Check if it's a local IPv4 address.
    return ipComponents[0] == 10 ||
           ipComponents[0] == 127 || // loopback address
          (ipComponents[0] == 192 && ipComponents[1] == 168) ||
          (ipComponents[0] == 169 && ipComponents[1] == 254) ||
          (ipComponents[0] == 172 && ipComponents[1] >= 16 && ipComponents[1] < 32);
  }

  // IPv6 address?
  ipComponents = aIPAddress.split(":");
  if (ipComponents.length == 8)
  {
    // ::1/128 - localhost
    if (ipComponents[0] == "0000" && ipComponents[1] == "0000" &&
        ipComponents[2] == "0000" && ipComponents[3] == "0000" &&
        ipComponents[4] == "0000" && ipComponents[5] == "0000" &&
        ipComponents[6] == "0000" && ipComponents[7] == "0001")
      return true;

    // fe80::/10 - link local addresses
    if (ipComponents[0] == "fe80")
      return true;

    // fc00::/7 - unique local addresses
    if (ipComponents[0].substr(0,2) == "fc" || // usage has not been defined yet
        ipComponents[0].substr(0,2) == "fd")
      return true;

    return false;
  }
  return false;
}