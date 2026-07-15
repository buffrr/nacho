import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HandlesStackParamList } from "@/Navigation";
import { HandleData, useStore } from "@/Store";
import { Colors, useTheme } from "@/theme";
import { Layout } from "@/ui/Layout";
import { BottomNav } from "@/ui/BottomNav";
import { Badge } from "@/ui/Badge";
import { scriptForHandle } from "@/keys";
import {
  fetchProposedHandles,
  fetchHandlesStatuses,
  formatPrice,
  HandleStatus,
} from "@/api";
import {
  getHandleBadge,
  sovereigntyBadge,
  scriptMatchesStatus,
  StatusBadge,
  STATUS_COLOR,
} from "@/handleStatus";

type ListHandlesNavigationProp = NativeStackNavigationProp<
  HandlesStackParamList,
  "ListHandles"
>;

interface Props {
  navigation: ListHandlesNavigationProp;
}

export default function ListHandles({ navigation }: Props) {
  const { xpub, handles } = useStore();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [searchQuery, setSearchQuery] = useState("");
  const [proposedHandles, setProposedHandles] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<Record<string, HandleStatus>>({});

  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      if (searchQuery) {
        const results = await fetchProposedHandles(searchQuery);
        setProposedHandles(results);
      } else {
        setProposedHandles([]);
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handlesMap = handles || {};
  const handlesList = Object.entries(handlesMap);
  const handlesKey = handlesList.map(([name]) => name).join(",");

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const names = handlesKey ? handlesKey.split(",") : [];
        if (names.length === 0) {
          setStatuses({});
          return;
        }
        const results = await fetchHandlesStatuses(names);
        if (!active) return;
        setStatuses((prev) => {
          const next = { ...prev };
          for (const status of results) {
            next[status.handle] = status;
          }
          return next;
        });
      })();
      return () => {
        active = false;
      };
    }, [handlesKey]),
  );

  // Statuses (with price) for the proposed search results.
  useEffect(() => {
    if (proposedHandles.length === 0) {
      return;
    }
    let active = true;
    (async () => {
      const results = await fetchHandlesStatuses(proposedHandles);
      if (!active) return;
      setStatuses((prev) => {
        const next = { ...prev };
        for (const status of results) {
          next[status.handle] = status;
        }
        return next;
      });
    })();
    return () => {
      active = false;
    };
  }, [proposedHandles]);

  const badgeFor = (handleName: string, handleData: HandleData): StatusBadge => {
    const ourScript = xpub ? scriptForHandle(xpub, handleData) : null;
    // Prefer the cached certrelay resolution once the handle is live.
    const resolution = handleData.resolution;
    if (resolution?.found) {
      if (
        resolution.scriptPubkey &&
        ourScript &&
        resolution.scriptPubkey !== ourScript
      ) {
        return { label: "Different key", color: STATUS_COLOR.red };
      }
      return sovereigntyBadge(resolution.sovereignty);
    }
    const status = statuses[handleName];
    const scriptMatches =
      status && ourScript ? scriptMatchesStatus(status, ourScript) : null;
    return getHandleBadge({
      status: status?.status ?? null,
      hasCert: !!handleData.cert,
      scriptMatches,
      price: status?.price,
    });
  };
  const combinedHandles = [
    ...(searchQuery
      ? handlesList.filter(([handleName]) => handleName.includes(searchQuery))
      : handlesList),
    ...proposedHandles
      .filter((proposedHandle) => !handles || !handlesMap[proposedHandle])
      .map((handle) => [handle, null] as [string, null]),
  ];

  const renderItem = ({ item }: { item: [string, HandleData | null] }) => {
    const [handleName, handleData] = item;

    if (handleData === null) {
      return renderProposedHandle({ item: handleName });
    } else {
      return renderHandle({ item: [handleName, handleData] });
    }
  };

  const renderHandleName = (name: string) => {
    const parts = name.split("@");
    if (parts.length === 2) {
      return (
        <>
          <Text style={styles.handleSubPart}>{parts[0]}</Text>
          <Text style={styles.handleSpacePart}>@{parts[1]}</Text>
        </>
      );
    }
    return <Text style={styles.handleSpacePart}>{name}</Text>;
  };

  const renderMeta = (badge: StatusBadge) => (
    <View style={styles.metaCol}>
      <Badge label={badge.label} color={badge.color} />
      {badge.price !== undefined && (
        <Text style={styles.price}>{formatPrice(badge.price)}</Text>
      )}
    </View>
  );

  const renderHandle = ({
    item,
  }: {
    item: [string, HandleData];
  }) => {
    const [handleName, handleData] = item;
    const badge = badgeFor(handleName, handleData);

    return (
      <TouchableOpacity
        onPress={() =>
          navigation.navigate("ShowHandle", { handle: handleName })
        }
        style={styles.handleItem}
      >
        <View style={styles.handleContent}>
          <Text style={styles.handleName}>{renderHandleName(handleName)}</Text>
          {renderMeta(badge)}
        </View>
      </TouchableOpacity>
    );
  };

  const renderProposedHandle = ({ item }: { item: string }) => {
    const status = statuses[item];
    const badge = getHandleBadge({
      status: status?.status ?? "available",
      hasCert: false,
      scriptMatches: null,
      price: status?.price,
    });
    return (
      <TouchableOpacity
        style={styles.proposedHandleItem}
        onPress={() =>
          navigation.navigate("CreateRequest", { initialHandle: item })
        }
      >
        <View style={styles.handleContent}>
          <Text style={styles.handleName}>{renderHandleName(item)}</Text>
          {renderMeta(badge)}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Layout scrollable={false} footer={<BottomNav active="handles" />}>
      <View style={styles.searchContainer}>
        <TextInput
          value={searchQuery}
          onChangeText={(text) =>
            setSearchQuery(text.toLowerCase().replace(/[^a-z0-9@.\-]/g, ""))
          }
          placeholder="Search handles"
          placeholderTextColor={colors.placeholder}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <FlatList
        data={combinedHandles}
        renderItem={renderItem}
        keyExtractor={(item) => item[0]}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {searchQuery
                ? "No handles found"
                : "No handles yet. Tap + to create one."}
            </Text>
          </View>
        }
        style={styles.handlesList}
        showsVerticalScrollIndicator={false}
      />
    </Layout>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    searchContainer: {
      marginBottom: 20,
    },
    searchInput: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: c.text,
      fontFamily: "monospace",
      // @ts-ignore - web-only style to remove focus outline
      outlineStyle: "none",
    } as any,
    handlesList: {
      flex: 1,
    },
    handleItem: {
      backgroundColor: c.surface,
      borderRadius: 12,
      marginBottom: 12,
      padding: 16,
    },
    proposedHandleItem: {
      backgroundColor: c.surface,
      borderRadius: 12,
      marginBottom: 12,
      padding: 16,
    },
    handleContent: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    handleName: {
      fontSize: 18,
      fontWeight: "400",
      flex: 1,
    },
    handleSubPart: {
      color: c.text,
    },
    handleSpacePart: {
      color: c.accent,
    },
    metaCol: {
      alignItems: "flex-end",
      marginLeft: 8,
      gap: 6,
    },
    price: {
      color: c.textFaint,
      fontSize: 13,
      fontWeight: "600",
    },
    emptyContainer: {
      padding: 40,
      alignItems: "center",
    },
    emptyText: {
      color: c.textMuted,
      fontSize: 16,
    },
  });
