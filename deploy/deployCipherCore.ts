import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  console.log("\n--- DEPLOYING CIPHER CORE ---");

  // Treasury address abhi ke liye deployer hi rakhte hain
  const treasury = deployer;

  const cipherCore = await deploy("CipherCore", {
    from: deployer,
    args: [treasury], // Constructor args
    log: true,
  });

  console.log(`CipherCore deployed at: ${cipherCore.address}`);
};

export default func;
func.id = "deploy_cipher_core";
func.tags = ["CipherCore"];
func.dependencies = ["Mocks"]; // Ye ensure karega ki Mocks pehle deploy hon
