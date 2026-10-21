import React, { useEffect, useState } from 'react';
import { Modal, View } from 'react-native';

import { registerConfirmHost, type ConfirmRequest } from '../lib/confirm';
import { colors, radius, space } from '../theme';
import { Button, Row, Txt } from './ui';

export function ConfirmHost() {
  const [req, setReq] = useState<ConfirmRequest | null>(null);

  useEffect(() => {
    registerConfirmHost(setReq);
    return () => registerConfirmHost(null);
  }, []);

  return (
    <Modal visible={req !== null} transparent animationType="fade" onRequestClose={() => setReq(null)}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: space.lg }}>
        <View
          style={{
            width: '100%',
            maxWidth: 380,
            backgroundColor: colors.surface,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            padding: space.xl,
            gap: space.xl,
          }}
        >
          <Txt style={{ fontSize: 17, lineHeight: 24 }}>{req?.message}</Txt>
          <Row>
            <Button label={req?.noLabel ?? ''} variant="secondary" flex onPress={() => setReq(null)} />
            <Button
              label={req?.yesLabel ?? ''}
              flex
              onPress={() => {
                const r = req;
                setReq(null);
                r?.onYes();
              }}
            />
          </Row>
        </View>
      </View>
    </Modal>
  );
}
