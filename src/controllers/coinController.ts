import { Request, Response } from "express";
import { prisma } from "../utils/prisma";
import QRCode from "qrcode";

export const getCoins = async (req: Request, res: Response) => {
  try {
    const { active } = req.query;

    const coins = await prisma.coin.findMany({
      where: {
        ...(active === "true" && { isActive: true }),
        ...(active === "false" && { isActive: false }),
      },
      orderBy: {
        symbol: "asc",
      },
      include: {
        networks: {
          include: {
            network: {
              select: {
                id: true,
                slug: true,
                name: true,
                type: true,
                chainId: true,
                icon: true,
                isActive: true,
              },
            },
          },
        },
        _count: {
          select: {
            wallets: true,
            orders: true,
          },
        },
      },
    });

    const coinsWithQr = await Promise.all(
      coins.map(async (coin) => {
        const networks = await Promise.all(
          coin.networks.map(async (cn) => {
            let qrCode: string | null = null;

            if (cn.contractAddress) {
              try {
                qrCode = await QRCode.toDataURL(cn.contractAddress);
              } catch (err) {
                console.error(
                  `QR generation failed for ${coin.symbol}`,
                  err
                );
              }
            }

            return {
              id: cn.id,
              isActive: cn.isActive,
              contractAddress: cn.contractAddress,
              qrCode,
              network: cn.network,
            };
          })
        );

        return {
          id: coin.id,
          symbol: coin.symbol,
          name: coin.name,
          iconUrl: coin.iconUrl,
          isActive: coin.isActive,
          counts: coin._count,
          networks,
        };
      })
    );

    res.json({
      success: true,
      count: coinsWithQr.length,
      coins: coinsWithQr,
    });
  } catch (error) {
    console.error("getCoins error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch coins",
    });
  }
};

export const getCoin = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const coin = await prisma.coin.findUnique({
      where: { id },
      include: {
        networks: {
          include: { network: true },
        },
      },
    });

    if (!coin) return res.status(404).json({ error: "Coin not found" });

    const networksWithQr = await Promise.all(
      coin.networks.map(async (cn: any) => {
        let qrCode = "";
        if (cn.contractAddress) {
          try {
            qrCode = await QRCode.toDataURL(cn.contractAddress);
          } catch (e) {
            console.error("QR Gen Error", e);
          }
        }
        return { ...cn, qrCode };
      })
    );

    res.json({ ...coin, networks: networksWithQr });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch coin" });
  }
};
