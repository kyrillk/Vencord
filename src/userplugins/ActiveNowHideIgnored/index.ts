/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { RelationshipStore } from "@webpack/common";

import { contextMenus, isGuildBlacklisted, isUserBlacklisted, ResetButton } from "./activeNowIgnoreList";

// const logger = new Logger("ActiveNowHideIgnored");
export const settings = definePluginSettings({
    hideActiveNow: {
        type: OptionType.BOOLEAN,
        description: "Hide/Show servers instead of just users in the Active Now section",
        default: false,
        restartNeeded: false
    },
    splitVoiceChannels: {
        description: "Show separate cards for each voice channel instead of combining them",
        type: OptionType.BOOLEAN,
        default: false,
        restartNeeded: false
    },
    whitelistUsers: {
        description: "Turn the blacklist into a whitelist for users, so only the users in the list will be shown",
        type: OptionType.BOOLEAN,
        restartNeeded: false,
    },
    whitelistServers: {
        description: "Turn the blacklist into a whitelist for server, so only the servers in the list will be shown",
        type: OptionType.BOOLEAN,
        restartNeeded: false,
    },
    hideIgnoredUsers: {
        description: "Hide ignored users in the main Active Now section",
        type: OptionType.BOOLEAN,
        default: true,
        restartNeeded: false,
    },
    hideFriendsList: {
        description: "Hide ignored users in the friends list",
        type: OptionType.BOOLEAN,
        default: true,
        restartNeeded: true,
    },
    resetData: {
        type: OptionType.COMPONENT,
        description: "Reset all blacklisted/whitelisted users and servers",
        component: ResetButton
    },
});

// Defines everything that the plugin does, including patches, settings, and context menus.
export default definePlugin({
    name: "Active Now Hide Ignored",
    description: "Hides Active Now entries for ignored users.",
    authors: [{ name: "kyrillk", id: 0n }],
    contextMenus,
    settings,
    patches: [
        // Patch to split parties with multiple voice channels into separate cards
        // This patches the .map() in function D() where nowPlayingCards are rendered
        // {
        //     find: "nowPlayingCards,loaded:",
        //     replacement: {
        //         // Match: e.map(e=>{let{party:t}=e;return
        //         // The pattern: variable.map(param=>{let{party:var}=param;return
        //         match: /(\i)\.map\((\i)=>\{let\{party:(\i)\}=\2;return/,
        //         replace: "$1.flatMap(c=>$self.settings.store.splitVoiceChannels&&c.party&&c.party.voiceChannels&&c.party.voiceChannels.length>1?$self.splitPartyByVoiceChannels(c.party).map(party=>({...c,party})):c).map($2=>{let{party:$3}=$2;return"
        //     },
        //     predicate: () => settings.store.splitVoiceChannels
        // },
        // Patch to filter parties (existing patch)
        {
            find: "NOW_PLAYING_CARD_HOVERED,",
            replacement: {
                match: /let{party:(\i),onUserContextMenu:(\i),onChannelContextMenu:(\i),quest:(\i)}=(\i),/,
                replace: "let{party:unfilter_$1,onUserContextMenu:$2,onChannelContextMenu:$3,quest:$4}=$5,$1=$self.partyFilterIgnoredUsers(unfilter_$1);if($self.shoudBeNull($1)){return null;}let ",
            },
            predicate: () => !settings.store.hideActiveNow
        },
        {
            find: "}=this.state,{children:",
            replacement: {
                match: /user:(\i)(.*)this.props;/,
                replace: "$&if($self.isIgnoredUser($1)){return null;}",
            },
            predicate: () => settings.store.hideFriendsList
        },
    ],
    isIgnoredUser,
    partyFilterIgnoredUsers,
    shoudBeNull,
    splitPartyByVoiceChannels,

    // Split a card's party into multiple cards if it has multiple voice channels
    maybeSplitCard(card: any) {
        if (!card?.party) return [card];

        const { party } = card;
        if (!party.voiceChannels || party.voiceChannels.length <= 1) {
            return [card];
        }

        // DEBUG: Log when splitting and inspect voiceChannels
        console.log("[ActiveNowHideIgnored] Splitting card for party:", party.id, party.voiceChannels);
        party.voiceChannels.forEach((vc, idx) => {
            console.log(`[ActiveNowHideIgnored] voiceChannel[${idx}] =`, vc);
        });

        // Split the party and create new card objects
        return splitPartyByVoiceChannels(party).map(newParty => ({
            ...card,
            party: newParty
        }));
    },
});

function isIgnoredUser(user) {
    const userId = user.id || user;
    if (isUserBlacklisted(userId) || (RelationshipStore.isIgnored(userId)) && settings.store.hideIgnoredUsers) {
        return true;
    }
    return false;
}
function anyIgnoredUser(users) {
    return users.some(user => isIgnoredUser(user));
}
// party functions

function partyFilterIgnoredUsers(party) {


    var filteredPartyMembers = party.partiedMembers.filter(user => !isIgnoredUser(user));
    var filteredPartyMembersLength = filteredPartyMembers.length;
    if (filteredPartyMembersLength === 0) return { ...party, partiedMembers: [] };

    if (settings.store.hideActiveNow) {
        if (settings.store.whitelistUsers) return party;
        if (filteredPartyMembersLength !== party.partiedMembers.length) return { ...party, partiedMembers: [] };
    }



    const filteredParty = {
        ...party,
        partiedMembers: filteredPartyMembers,

        currentActivities: party.currentActivities
            .map(activity => activityFilterIgnoredUsers(activity))
            .filter(activity => activity !== null && activity !== undefined),
        priorityMembers: party.priorityMembers
            .map(priorityMember => priorityMembersFilterIgnoredUsers(party.priorityMembers, priorityMember, filteredPartyMembers))
            .filter(priorityMember => priorityMember !== null && priorityMember !== undefined),
        voiceChannels: party.voiceChannels
            .map(voiceChannel => voiceChannelFilterIgnoredUsers(voiceChannel))
            .filter(voiceChannel => voiceChannel !== null && voiceChannel !== undefined),
    };
    return filteredParty;
}

// needed?
function activityFilterIgnoredUsers(activity) {
    var filteredActivityUser = activity.activityUser;
    var filteredPlayingMembers = activity.playingMembers.filter(user => !isIgnoredUser(user));
    if (isIgnoredUser(activity.activityUser)) {
        if (filteredPlayingMembers.length === 0) {
            return null;
        } else if (isIgnoredUser(activity.activityUser)) {
            filteredActivityUser = filteredPlayingMembers[0];
        }
    }

    // change to Const when fixed
    var filteredActivity = {
        ...activity,
        activityUser: filteredActivityUser,
        playingMembers: filteredPlayingMembers,
    };

    return filteredActivity;
}

function priorityMembersFilterIgnoredUsers(priorityMembers, priorityMember, partiedMembers) {
    var filteredUser = priorityMember.user;
    if (isIgnoredUser(filteredUser)) {
        if (partiedMembers.length === 1) {
            return null;
        }
        filteredUser = partiedMembers.find(user => !priorityMembers.some(pm => pm.user.id === user.id));

        if (!filteredUser) {
            return null;
        }
    }
    const filteredPriorityMember = {
        ...priorityMember,
        user: filteredUser,
    };
    return filteredPriorityMember;
}

function voiceChannelFilterIgnoredUsers(voiceChannel) {
    const filteredVoiceChannel = {
        ...voiceChannel,
        members: voiceChannel.members.filter(user => !isIgnoredUser(user)),
        voiceStates: Object.fromEntries(
            Object.entries(voiceChannel.voiceStates).filter(([userId]) =>
                !isIgnoredUser({ id: userId })
            )
        )
    };
    return filteredVoiceChannel;
}
// guild functions


function isIgnoredGuild(guild) {
    if (isGuildBlacklisted(guild)) {
        return true;
    }
    return false;
}
// input can be a array of channels or a party
function filterIgnoredGuilds(input) {
    if (!input) {
        return false;
    }
    var voiceChannels = input.voiceChannels || input;
    return voiceChannels.some(voiceChannel => isIgnoredGuild(voiceChannel.guild.id));
}

// add logic for whitelist
function shoudBeNull(Party) {
    if (!Party) return true;
    if (Party.partiedMembers.length === 0 || filterIgnoredGuilds(Party)) return true;
    return false;
}

// Split a party with multiple voice channels into separate parties (one per voice channel)
function splitPartyByVoiceChannels(party) {
    if (!party || !party.voiceChannels || party.voiceChannels.length <= 1) {
        return [party]; // No splitting needed
    }

    return party.voiceChannels.map(voiceChannel => {
        const membersInChannel = voiceChannel.members || [];
        const memberIds = new Set(membersInChannel.map(m => m.id));

        // Filter partiedMembers safely
        const filteredPartiedMembers = Array.isArray(party.partiedMembers)
            ? party.partiedMembers.filter(member => member && member.id && memberIds.has(member.id))
            : [];

        // Log any invalid priority members for debugging
        if (Array.isArray(party.priorityMembers)) {
            party.priorityMembers.forEach(pm => {
                if (!pm?.user?.id) {
                    console.warn("Invalid priority member found:", pm);
                }
            });
        }

        // Filter priorityMembers safely
        const filteredPriorityMembers = Array.isArray(party.priorityMembers)
            ? party.priorityMembers.filter(pm => pm?.user?.id && memberIds.has(pm.user.id))
            : [];

        return {
            ...party,
            partiedMembers: filteredPartiedMembers.length > 0 ? filteredPartiedMembers : membersInChannel,
            priorityMembers: filteredPriorityMembers,
            voiceChannels: [voiceChannel], // Only this voice channel
            currentActivities: [], // Activities don't apply to split voice channel cards
        };
    });
}

