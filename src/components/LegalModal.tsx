// Terms of use and privacy texts, for Mexico or the USA, in a full screen sheet.
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT } from '../i18n';
import { LEGAL_TEXTS, type LegalCountry, type LegalDoc } from '../legal/texts';
import { useApp } from '../store/AppStore';
import { colors, space } from '../theme';
import { Button, Row, Segmented, Txt } from './ui';

export function LegalModal({ doc, onClose }: { doc: LegalDoc | null; onClose: () => void }) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { settings } = useApp();
  const [country, setCountry] = useState<LegalCountry>(settings.language === 'en' ? 'us' : 'mx');
  const [which, setWhich] = useState<LegalDoc>(doc ?? 'terms');
  useEffect(() => {
    if (doc) setWhich(doc);
  }, [doc]);
  const text = LEGAL_TEXTS[country][which];

  return (
    <Modal visible={!!doc} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
        <View style={{ width: '100%', maxWidth: 640, alignSelf: 'center', flex: 1 }}>
          <Row style={{ justifyContent: 'space-between', padding: space.lg }}>
            <Txt variant="h2" style={{ flex: 1 }} numberOfLines={1}>
              {text.title}
            </Txt>
            <Button label={t('common.done')} size="sm" variant="ghost" onPress={onClose} />
          </Row>
          <View style={{ paddingHorizontal: space.lg, gap: space.sm }}>
            <Segmented
              small
              value={which}
              onChange={setWhich}
              options={[
                { value: 'terms', label: t('legal.terms') },
                { value: 'privacy', label: t('legal.privacy') },
              ]}
            />
            <Segmented
              small
              value={country}
              onChange={setCountry}
              options={[
                { value: 'mx', label: 'México' },
                { value: 'us', label: 'USA' },
              ]}
            />
          </View>
          <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: Math.max(insets.bottom, space.lg) + space.xl, gap: space.md }}>
            <LegalBody body={text.body} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// Paragraphs split by a blank line, "- " bullets, **bold**, and a whole *italic* line.
function LegalBody({ body }: { body: string }) {
  return (
    <>
      {body.split('\n\n').map((block, i) => {
        if (/^\*[^*].*\*$/.test(block)) {
          return (
            <Txt key={i} variant="small" color={colors.muted}>
              {block.slice(1, -1)}
            </Txt>
          );
        }
        if (block.startsWith('- ')) {
          return (
            <View key={i} style={{ gap: 6 }}>
              {block.split('\n').map((line, j) => (
                <Row key={j} style={{ alignItems: 'flex-start' }}>
                  <Txt color={colors.accent}>•</Txt>
                  <Txt style={{ flex: 1, lineHeight: 22 }}>{rich(line.replace(/^- /, ''))}</Txt>
                </Row>
              ))}
            </View>
          );
        }
        return (
          <Txt key={i} style={{ lineHeight: 22 }}>
            {rich(block)}
          </Txt>
        );
      })}
    </>
  );
}

function rich(text: string) {
  return text.split(/\*\*(.+?)\*\*/).map((part, i) =>
    i % 2 ? (
      <Text key={i} style={{ fontWeight: '800', color: colors.text }}>
        {part}
      </Text>
    ) : (
      part
    ),
  );
}

// "Términos de uso · Aviso de privacidad" links that open the sheet.
export function LegalLinks({ onOpen, center }: { onOpen: (doc: LegalDoc) => void; center?: boolean }) {
  const t = useT();
  return (
    <Row gap={space.lg} style={{ justifyContent: center ? 'center' : 'flex-start', flexWrap: 'wrap' }}>
      <Pressable onPress={() => onOpen('terms')} accessibilityRole="link" hitSlop={6}>
        <Txt variant="small" color={colors.accent} style={{ textDecorationLine: 'underline' }}>
          {t('legal.terms')}
        </Txt>
      </Pressable>
      <Pressable onPress={() => onOpen('privacy')} accessibilityRole="link" hitSlop={6}>
        <Txt variant="small" color={colors.accent} style={{ textDecorationLine: 'underline' }}>
          {t('legal.privacy')}
        </Txt>
      </Pressable>
    </Row>
  );
}
