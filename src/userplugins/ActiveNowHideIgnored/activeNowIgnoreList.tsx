/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import * as DataStore from "@api/DataStore";
import { Menu, showToast, Toasts } from "@webpack/common";
import { Guild, User } from "discord-types/general";

// Blacklist storage
let blacklistedUsers: Set<string> = new Set();
let blacklistedGuilds: Set<string> = new Set();

// Load blacklists from localStorage on startup
async function loadBlacklists() {
    try {
        const storedUsers = await DataStore.get("activeNowHideIgnored_blacklistedUsers");
        const storedGuilds = await DataStore.get("activeNowHideIgnored_blacklistedGuilds");

        if (storedUsers) {
            blacklistedUsers = new Set(storedUsers);
        }
        if (storedGuilds) {
            blacklistedGuilds = new Set(storedGuilds);
        }
    } catch (e) {
        console.error("Failed to load blacklists:", e);
    }
}

// Save blacklists to DataStore
async function saveBlacklists() {
    try {
        await DataStore.set("activeNowHideIgnored_blacklistedUsers", [...blacklistedUsers]);
        await DataStore.set("activeNowHideIgnored_blacklistedGuilds", [...blacklistedGuilds]);
    } catch (e) {
        console.error("Failed to save blacklists:", e);
    }
}

// Initialize blacklists
loadBlacklists();

// Add/remove functions async
async function addUserToBlacklist(userId: string, username: string) {
    blacklistedUsers.add(userId);
    await saveBlacklists();
    showToast(`Hidden ${username} from Active Now`, Toasts.Type.SUCCESS);
}

async function removeUserFromBlacklist(userId: string, username: string) {
    blacklistedUsers.delete(userId);
    await saveBlacklists();
    showToast(`Unhidden ${username} from Active Now`, Toasts.Type.SUCCESS);
}

async function addGuildToBlacklist(guildId: string, guildName: string) {
    blacklistedGuilds.add(guildId);
    await saveBlacklists();
    showToast(`Hidden ${guildName} from Active Now`, Toasts.Type.SUCCESS);
}

async function removeGuildFromBlacklist(guildId: string, guildName: string) {
    blacklistedGuilds.delete(guildId);
    await saveBlacklists();
    showToast(`Unhidden ${guildName} from Active Now`, Toasts.Type.SUCCESS);
}

// Export helper functions for use in main plugin
export function isUserBlacklisted(userId: string): boolean {
    return blacklistedUsers.has(userId);
}

export function isGuildBlacklisted(guildId: string): boolean {
    return blacklistedGuilds.has(guildId);
}

export function getBlacklistedUsers(): string[] {
    return [...blacklistedUsers];
}

export function getBlacklistedGuilds(): string[] {
    return [...blacklistedGuilds];
}

// Helper function to search recursively for any item by ID
function findItemInChildren(items, targetId) {
    if (!items) return null;

    const itemsArray = Array.isArray(items) ? items : [items];

    for (let i = 0; i < itemsArray.length; i++) {
        const item = itemsArray[i];

        // Check if this is the item we're looking for
        if (item?.props?.id === targetId) {
            return { container: itemsArray, index: i };
        }

        // If this item has children, search recursively
        if (item?.props?.children) {
            const result = findItemInChildren(item.props.children, targetId);
            if (result) return result;
        }
    }

    return null;
}

// Guild context menu patches
const guildPopoutPatch: NavContextMenuPatchCallback = (children, { guild }: { guild: Guild, onClose(): void; }) => {
    if (!guild) return;

    const isBlacklisted = isGuildBlacklisted(guild.id);

    const menuItem = (
        <Menu.MenuItem
            label={isBlacklisted ? "Show in Active Now" : "Hide in Active Now"}
            id="HideActiveNowIgnored-guild"
            action={() => {
                if (isBlacklisted) {
                    removeGuildFromBlacklist(guild.id, guild.name);
                } else {
                    addGuildToBlacklist(guild.id, guild.name);
                }
            }}
        />
    );

    // Search for the leaver server item using recursive search
    const ignoreLocation = findItemInChildren(children, "leave-guild");

    if (ignoreLocation) {
        // Insert before the leaver server item
        ignoreLocation.container.splice(ignoreLocation.index, 0, menuItem);
    } else {
        children.push(menuItem);
    }

};

const userContextPatch: NavContextMenuPatchCallback = (children, { user }: { user?: User, onClose(): void; }) => {
    if (!user) return;

    const isBlacklisted = isUserBlacklisted(user.id);

    const menuItem = (
        <Menu.MenuItem
            label={isBlacklisted ? "Show in Active Now" : "Hide in Active Now"}
            id="HideActiveNowIgnored-user"
            action={() => {
                if (isBlacklisted) {
                    removeUserFromBlacklist(user.id, user.username);
                } else {
                    addUserToBlacklist(user.id, user.username);
                }
            }}
        />
    );

    // Search for the ignore item using recursive search
    const ignoreLocation = findItemInChildren(children, "ignore");

    if (ignoreLocation) {
        // Insert before the ignore item
        ignoreLocation.container.splice(ignoreLocation.index, 0, menuItem);
    } else {
        children.push(menuItem);
    }
};

// User context menu patches
/*
const userContextPatch: NavContextMenuPatchCallback = (children, { user }: { user?: User, onClose(): void; }) => {
    console.log("[HideActiveNowIgnored] userContextPatch called", {
        timestamp: new Date().toISOString(),
        user: user ? { id: user.id, username: user.username } : null,
        childrenCount: children.length
    });

    if (!user) {
        console.log("[HideActiveNowIgnored] No user provided, exiting");
        return;
    }

    const isBlacklisted = isUserBlacklisted(user.id);
    console.log("[HideActiveNowIgnored] User blacklist status", {
        userId: user.id,
        username: user.username,
        isBlacklisted
    });

    const menuItem = (
        <Menu.MenuItem
            label={isBlacklisted ? "Show in Active Now" : "Hide in Active Now"}
            id="HideActiveNowIgnored-user"
            action={() => {
                console.log("[HideActiveNowIgnored] Menu item clicked", {
                    userId: user.id,
                    username: user.username,
                    action: isBlacklisted ? "unhide" : "hide"
                });

                if (isBlacklisted) {
                    removeUserFromBlacklist(user.id, user.username);
                } else {
                    addUserToBlacklist(user.id, user.username);
                }
            }}
        />
    );

    // Function to search recursively for the ignore item
    function findIgnoreItem(items, depth = 0) {
        const indent = "  ".repeat(depth);
        console.log(`${indent}[HideActiveNowIgnored] Searching at depth ${depth}, items:`, items?.length || 0);

        if (!items) return null;

        const itemsArray = Array.isArray(items) ? items : [items];

        for (let i = 0; i < itemsArray.length; i++) {
            const item = itemsArray[i];
            console.log(`${indent}  Item ${i}:`, {
                type: item?.type?.displayName || item?.type?.name || typeof item?.type,
                id: item?.props?.id,
                label: item?.props?.label,
                hasChildren: !!item?.props?.children
            });

            // Check if this item is the ignore item
            if (item?.props?.id === "ignore") {
                console.log(`${indent}  Found ignore item at depth ${depth}, index ${i}!`);
                return { container: itemsArray, index: i };
            }

            // If this item has children, search recursively
            if (item?.props?.children) {
                const result = findIgnoreItem(item.props.children, depth + 1);
                if (result) return result;
            }
        }

        return null;
    }

    // Search for the ignore item starting from the main children
    const ignoreLocation = findIgnoreItem(children);

    if (ignoreLocation) {
        console.log("[HideActiveNowIgnored] Found ignore item, adding our item before it");
        ignoreLocation.container.splice(ignoreLocation.index, 0, menuItem);
        console.log("[HideActiveNowIgnored] Successfully inserted menu item");
    } else {
        console.log("[HideActiveNowIgnored] Ignore item not found, checking index 4 specifically");

        // Let's specifically look at index 4 since you mentioned it should be there
        const index4 = children[4];
        if (index4?.props?.children) {
            console.log("[HideActiveNowIgnored] Index 4 has children, adding to first MenuGroup");
            const childrenArray = Array.isArray(index4.props.children) ? index4.props.children : [index4.props.children];

            // Find the first MenuGroup in index 4's children
            const firstMenuGroup = childrenArray.find(child =>
                child?.type?.displayName === "MenuGroup" || child?.type?.name === "MenuGroup"
            );

            if (firstMenuGroup?.props?.children) {
                console.log("[HideActiveNowIgnored] Adding to first MenuGroup in index 4");
                const groupChildren = Array.isArray(firstMenuGroup.props.children)
                    ? firstMenuGroup.props.children
                    : [firstMenuGroup.props.children];
                groupChildren.push(menuItem);
                firstMenuGroup.props.children = groupChildren;
            } else {
                // Fallback: add to end of main children
                console.log("[HideActiveNowIgnored] Fallback: adding to end of children");
                children.push(menuItem);
            }
        } else {
            // Final fallback
            console.log("[HideActiveNowIgnored] Final fallback: adding to end of children");
            children.push(menuItem);
        }
    }

    console.log("[HideActiveNowIgnored] userContextPatch completed", {
        finalChildrenCount: children.length,
        timestamp: new Date().toISOString()
    });
};*/

export const contextMenus = {
    "channel-context": guildPopoutPatch, // check for guild id?
    "guild-header-popout": guildPopoutPatch,
    "guild-context": guildPopoutPatch,
    "user-context": userContextPatch,
    "user-profile-actions": userContextPatch,
    "user-profile-overflow-menu": userContextPatch,
};
