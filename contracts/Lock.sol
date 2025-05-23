// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

contract Lock {
    uint public unlockTime;
    address payable public owner;

    event Received(address sender, uint amount);

    event Withdrawal(uint amount, uint when);

    constructor(address _owner, uint _unlockTime) payable {
        require(
            _owner != 0x0000000000000000000000000000000000000000,
            "Owner must not be zero"
        );
        require(
            block.timestamp < _unlockTime,
            "Unlock time should be in the future"
        );

        unlockTime = _unlockTime;
        owner = payable(_owner);
    }

    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    function withdraw() public {
        require(block.timestamp >= unlockTime, "You can't withdraw yet");
        require(msg.sender == owner, "You aren't the owner");

        emit Withdrawal(address(this).balance, block.timestamp);

        owner.transfer(address(this).balance);
    }

    function setUnlockTime(uint _unlockTime) public {
        require(block.timestamp >= unlockTime, "You can't change time yet");
        require(msg.sender == owner, "You aren't the owner");
        require(
            block.timestamp < _unlockTime,
            "Unlock time should be in the future"
        );

        unlockTime = _unlockTime;
    }

    function setOwner(address _owner) public {
        require(msg.sender == owner, "You aren't the owner");
        require(
            _owner != 0x0000000000000000000000000000000000000000,
            "Owner must not be zero"
        );

        owner = payable(_owner);
    }
}
