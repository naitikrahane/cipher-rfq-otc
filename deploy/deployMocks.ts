import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  console.log("\n--- DEPLOYING MOCKS ---");

  // 1. Asset Token (e.g. Wrapped Bitcoin)
  const mockToken = await deploy("MockERC20", {
    from: deployer,
    args: ["Wrapped Bitcoin", "WBTC"],
    log: true,
  });
  console.log(`Asset Token deployed at: ${mockToken.address}`);

  // 2. Payment Token (e.g. Zama USD)
  const confidentialToken = await deploy("ConfidentialERC20", {
    from: deployer,
    args: ["Zama USD", "zUSD"],
    log: true,
  });
  console.log(`Payment Token deployed at: ${confidentialToken.address}`);
};

export default func;
func.id = "deploy_mocks";
func.tags = ["Mocks"];
