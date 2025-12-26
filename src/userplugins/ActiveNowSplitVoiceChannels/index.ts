/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";

const settings = definePluginSettings({
    splitVoiceChannels: {
        description: "Show separate cards for each voice channel instead of combining them (at data source)",
        type: OptionType.BOOLEAN,
        default: true,
        restartNeeded: false
    }
});

export default definePlugin({
    name: "Active Now Split Voice Channels",
    description: "Splits Now Playing parties with multiple voice channels into separate cards at the data source.",
    authors: [{ name: "kyrillk", id: 0n }],
    settings,
    patches: [
        {
            find: "NowPlayingViewStore",
            replacement: {
                match: /return\s*\{\s*id:\s*n,\s*voiceChannels:\s*G,\s*isSpotifyActivity:\s*g,\s*priorityMembers:\s*f\.map\([^}]+\),\s*partiedMembers:\s*s,\s*showPlayingMembers:\s*p,\s*guildContext:\s*r,\s*currentActivities:[^,]+,\s*applicationStreams:\s*E\s*\}/,
                replace: `
                        if ($self.settings.store.splitVoiceChannels && Array.isArray(G) && G.length > 1) {
                            const split = G.map((vc, idx) => {
                                const membersInChannel = vc.members || [];
                                const memberIds = new Set(membersInChannel.map(m => m.id));
                                const filteredPriorityMembers = Array.isArray(f)
                                    ? f.filter(pm => pm && memberIds.has(pm.id))
                                    : [];
                                return {
                                    id: n + "-vc-" + (vc.channel?.id || idx),
                                    voiceChannels: [vc],
                                    isSpotifyActivity: g,
                                    priorityMembers: filteredPriorityMembers.map(e => ({ user: e, status: x.Z.getStatus(e.id) })),
                                    partiedMembers: membersInChannel,
                                    showPlayingMembers: p,
                                    guildContext: r,
                                    currentActivities: eu(m, e => { var t; return null != (t = e.startedPlayingTime) ? t : 0 }).value(),
                                    applicationStreams: E
                                };
                            });
                            console.log("[ActiveNowSplitVoiceChannels] Returning split parties:", split);
                            return split;
                        }
                        const party = {
                            id: n,
                            voiceChannels: G,
                            isSpotifyActivity: g,
                            priorityMembers: f.map(e => ({
                                user: e,
                                status: x.Z.getStatus(e.id)
                            })),
                            partiedMembers: s,
                            showPlayingMembers: p,
                            guildContext: r,
                            currentActivities: eu(m, e => { var t; return null != (t = e.startedPlayingTime) ? t : 0 }).value(),
                            applicationStreams: E
                        };
                        console.log("[ActiveNowSplitVoiceChannels] Returning single party:", party);
                        return party;
                    `
            },
            predicate: () => settings.store.splitVoiceChannels
        }
    ]
});
