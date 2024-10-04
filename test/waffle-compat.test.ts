import { expect } from "chai";
import { deployMockContract } from "../src/compat/waffle.js";
import hre from "hardhat";
import { zeroAddress } from "viem";

const erc20ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [{ type: "address" }, { type: "uint256" }],
    outputs: [],
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [{ type: "address" }, { type: "address" }, { type: "uint256" }],
    anonymous: false,
  },
] as const;

describe("waffle", function () {
  describe("compat", function () {
    it("Should allow for the mocking of read calls", async function () {
      const reader = await hre.viem.getPublicClient();
      const [signer] = await hre.viem.getWalletClients();
      const mock = await deployMockContract<typeof erc20ABI>(
        signer,
        reader,
        erc20ABI,
      );
      console.log(`Deployed mock at ${mock.address}`);

      await mock.mock.balanceOf.withArgs(zeroAddress).returns(100n);

      expect(
        await reader.readContract({
          address: mock.address,
          abi: erc20ABI,
          functionName: "balanceOf",
          args: [zeroAddress],
        }),
      ).to.equal(100n);
    });

    it("Should allow for the mocking of write calls", async function () {
      const reader = await hre.viem.getPublicClient();
      const [signer] = await hre.viem.getWalletClients();
      const mock = await deployMockContract<typeof erc20ABI>(
        signer,
        reader,
        erc20ABI,
      );

      await mock.mock.transfer.withArgs(zeroAddress, 100n);

      await signer.writeContract({
        address: mock.address,
        abi: erc20ABI,
        functionName: "transfer",
        args: [zeroAddress, 100n],
      });
    });

    it("Should allow for the mocking of reverts on read calls", async function () {
      const reader = await hre.viem.getPublicClient();
      const [signer] = await hre.viem.getWalletClients();
      const mock = await deployMockContract<typeof erc20ABI>(
        signer,
        reader,
        erc20ABI,
      );

      await mock.mock.balanceOf
        .withArgs(zeroAddress)
        .revertsWithReason("Custom reason");

      try {
        await reader.readContract({
          address: mock.address,
          abi: erc20ABI,
          functionName: "balanceOf",
          args: [zeroAddress],
        });
      } catch (error) {
        expect((error as Error).message).to.contain("Custom reason");
      }
    });

    it("Should fail if the mock is not set up", async function () {
      const reader = await hre.viem.getPublicClient();
      const [signer] = await hre.viem.getWalletClients();
      const mock = await deployMockContract<typeof erc20ABI>(
        signer,
        reader,
        erc20ABI,
      );

      try {
        await reader.readContract({
          address: mock.address,
          abi: erc20ABI,
          functionName: "balanceOf",
          args: [zeroAddress],
        });
      } catch (error) {
        expect((error as Error).message).to.contain(
          "Mock on the method is not initialized",
        );
      }
    });

    it("Should allow undefined call.inputs for read calls", async function () {
      const reader = await hre.viem.getPublicClient();
      const [signer] = await hre.viem.getWalletClients();
      const mock = await deployMockContract<typeof erc20ABI>(
        signer,
        reader,
        erc20ABI,
      );

      await mock.mock.balanceOf.returns(20998n);

      expect(
        await reader.readContract({
          address: mock.address,
          abi: erc20ABI,
          functionName: "balanceOf",
          args: [zeroAddress],
        }),
      ).to.equal(20998n);
    });
  });
});
