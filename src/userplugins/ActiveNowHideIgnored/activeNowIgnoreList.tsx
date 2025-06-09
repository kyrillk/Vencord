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

// Guild context menu patches
const guildPopoutPatch: NavContextMenuPatchCallback = (children, { guild }: { guild: Guild, onClose(): void; }) => {
    if (!guild) return;

    const isBlacklisted = isGuildBlacklisted(guild.id);

    // Find the index of the ignore menu item
    const menuItemIndex = children.findIndex(child =>
        child?.props?.id === "guild-context-leave-guild"
    );

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

    if (menuItemIndex !== -1) {
        // Insert before the ignore item
        children.splice(menuItemIndex, 0, menuItem);
    } else {
        // Fallback to end if ignore not found
        children.push(menuItem);
    }
};

// User context menu patches
const userContextPatch: NavContextMenuPatchCallback = (children, { user }: { user?: User, onClose(): void; }) => {
    if (!user) return;

    const isBlacklisted = isUserBlacklisted(user.id);

    // Find the index of the ignore menu item
    const ignoreIndex = children.findIndex(child =>
        child?.props?.id === "user-context-ignore"
    );

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

    if (ignoreIndex !== -1) {
        // Insert before the ignore item
        children.splice(ignoreIndex, 0, menuItem);
    } else {
        // Fallback to end if ignore not found
        children.push(menuItem);
    }
};

export const contextMenus = {
    "guild-header-popout": guildPopoutPatch,
    "guild-context": guildPopoutPatch,
    "user-context": userContextPatch,
    "user-profile-actions": userContextPatch,
    "user-profile-overflow-menu": userContextPatch,
};
